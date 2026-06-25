<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\AutomationActionItem;
use App\Models\AutomationTask;
use App\Models\ParseRun;
use App\Repositories\InstagramAccountRepositoryInterface;
use App\Repositories\ParsedTargetRepositoryInterface;
use App\Repositories\ParseRunRepositoryInterface;
use App\Services\Automation\TargetFilterServiceInterface;
use App\Services\InstagramClientServiceInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

final class ParseTargetsJob implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 1;
    public int $timeout = 300;

    private const PAGE_AMOUNT = 30;
    private const MAX_PAGES = 30;
    private const ENRICH_BATCH = 20;

    /**
     * Коды Instagram, при которых сессия фактически потеряна — дальнейший сбор бессмыслен.
     */
    private const FATAL_ERROR_CODES = ['challenge_required', 'login_required'];

    public function __construct(
        public readonly int $parseRunId
    ) {}

    public function handle(
        ParseRunRepositoryInterface $parseRunRepository,
        ParsedTargetRepositoryInterface $parsedTargetRepository,
        InstagramAccountRepositoryInterface $accountRepository,
        InstagramClientServiceInterface $instagramClient,
        TargetFilterServiceInterface $targetFilter
    ): void {
        $parseRun = $parseRunRepository->findById($this->parseRunId);

        if ($parseRun === null) {
            return;
        }

        $account = $accountRepository->findById((int) $parseRun->instagram_account_id);

        if ($account === null || !$account->session_data) {
            $parseRunRepository->updateStatus($this->parseRunId, 'failed', 'Аккаунт или сессия не найдены');

            return;
        }

        $userId    = (int) $parseRun->user_id;
        $accountId = (int) $account->id;
        $filters   = is_array($parseRun->filters_snapshot) ? $parseRun->filters_snapshot : [];
        $sourceValue = is_array($parseRun->source_value) ? $parseRun->source_value : [];

        $parseRunRepository->updateStatus($this->parseRunId, 'running');
        $parseRun->forceFill(['started_at' => now()])->save();

        try {
            $targetLimit = max(1, (int) $parseRun->target_limit);

            if ((string) $parseRun->source_type === 'my_following') {
                $kept = $this->collectFollowingTargets(
                    $instagramClient,
                    $parsedTargetRepository,
                    (string) $account->session_data,
                    $accountId,
                    $userId,
                    $targetLimit,
                    $scannedCount
                );

                $parseRun->forceFill([
                    'scanned_count'   => $scannedCount,
                    'collected_count' => $kept,
                    'status'          => 'completed',
                    'finished_at'     => now()
                ])->save();

                $this->broadcastProgress($this->parseRunId, 'completed', $kept);
                $this->scheduleFullAutoTask($parseRun);

                return;
            }

            $task = AutomationTask::where('parse_run_id', $this->parseRunId)->first();
            $isLikeAction = $task !== null && $task->action_type === 'like';
            $alreadyActionedMediaPkSet = $isLikeAction ? $this->alreadyActionedMediaPkSet($accountId) : [];

            $kept = $this->collectParsedTargets(
                $instagramClient,
                $parsedTargetRepository,
                $targetFilter,
                (string) $account->session_data,
                $accountId,
                $userId,
                (string) $parseRun->source_type,
                $sourceValue,
                $filters,
                $targetLimit,
                $isLikeAction,
                $alreadyActionedMediaPkSet,
                $scannedCount
            );

            $parseRun->forceFill([
                'scanned_count'   => $scannedCount,
                'collected_count' => $kept,
                'status'          => 'completed',
                'finished_at'     => now()
            ])->save();

            $this->broadcastProgress($this->parseRunId, 'completed', $kept);
            $this->scheduleFullAutoTask($parseRun);

        } catch (\Throwable $e) {
            $parseRun->forceFill([
                'status'        => 'failed',
                'error_message' => $e->getMessage(),
                'finished_at'   => now()
            ])->save();

            $this->broadcastProgress($this->parseRunId, 'failed', 0, $e->getMessage());

            throw $e;
        }
    }

    /**
     * Бросает исключение, если неуспех источника — РЕАЛЬНАЯ ошибка Instagram, а не штатный
     * конец данных. Признак ошибки — наличие error_code или непустого error в ответе Python
     * (InstagramClientService возвращает тело ответа «как есть», включая эти поля). Пустой
     * источник без признаков ошибки — не ошибка: возвращаемся, вызывающий делает мягкий break.
     *
     * @param array<string, mixed>|null $result
     */
    private function failOnSourceError(?array $result): void {
        $errorCode = $result === null ? null : ($result['error_code'] ?? null);
        $rawError  = $result === null ? null : ($result['error'] ?? null);

        if ($errorCode === null && !(is_string($rawError) && $rawError !== '')) {
            return;
        }

        throw new \RuntimeException($this->humanizeInstagramError(
            is_string($errorCode) ? $errorCode : '',
            is_string($rawError) ? $rawError : null
        ));
    }

    /**
     * Бросает исключение только на фатальных кодах (challenge/login) — для enrich, где сбой
     * отдельного батча не должен валить весь прогон, а потеря сессии — должна.
     *
     * @param array<string, mixed>|null $result
     */
    private function failOnFatalError(?array $result): void {
        $errorCode = $result === null ? null : ($result['error_code'] ?? null);

        if (!is_string($errorCode) || !in_array($errorCode, self::FATAL_ERROR_CODES, true)) {
            return;
        }

        throw new \RuntimeException($this->humanizeInstagramError($errorCode, null));
    }

    /**
     * Человекочитаемое русское сообщение по коду ошибки Instagram.
     */
    private function humanizeInstagramError(string $errorCode, ?string $rawError): string {
        return match ($errorCode) {
            'challenge_required' => 'Instagram требует подтверждение входа (challenge/checkpoint). Пройдите верификацию аккаунта в приложении Instagram с тем же прокси и обновите сессию, затем повторите.',
            'login_required'     => 'Сессия Instagram недействительна — требуется повторный вход. Обновите сессию аккаунта и повторите.',
            'rate_limited'       => 'Instagram временно ограничил частоту запросов (rate limit). Подождите и повторите позже.',
            'timeout'            => 'Превышено время ожидания ответа Instagram. Повторите позже.',
            default              => is_string($rawError) && $rawError !== ''
                ? "Ошибка Instagram при сборе целей: {$rawError}"
                : 'Не удалось собрать цели: Instagram вернул ошибку без описания'
        };
    }

    /**
     * Собирает, обогащает и сохраняет цели страницами до достижения target_limit.
     *
     * @param array<string, mixed> $sourceValue
     * @param array<string, mixed> $filters
     * @param array<string, bool> $alreadyActionedMediaPkSet
     */
    private function collectParsedTargets(
        InstagramClientServiceInterface $instagramClient,
        ParsedTargetRepositoryInterface $parsedTargetRepository,
        TargetFilterServiceInterface $targetFilter,
        string $sessionData,
        int $accountId,
        int $userId,
        string $sourceType,
        array $sourceValue,
        array $filters,
        int $targetLimit,
        bool $isLikeAction,
        array &$alreadyActionedMediaPkSet,
        ?int &$scannedCount
    ): int {
        $scannedCount = 0;
        $kept         = 0;
        $seen         = [];
        $cursor       = null;
        $page         = 0;

        while ($page < self::MAX_PAGES && $kept < $targetLimit) {
            $page++;

            $params = [
                'session_data' => $sessionData,
                'account_id'   => $accountId,
                'source_type'  => $sourceType,
                'amount'       => self::PAGE_AMOUNT
            ];

            isset($sourceValue['query']) && $params['query'] = $sourceValue['query'];
            isset($sourceValue['hashtags']) && $params['hashtags'] = $sourceValue['hashtags'];
            isset($sourceValue['location_pk']) && $params['location_pk'] = (int) $sourceValue['location_pk'];
            $cursor !== null && $params['next_max_id'] = $cursor;

            $result = $instagramClient->parseTargetsCandidates($params, $userId);

            if (empty($result['success'])) {
                // Различаем РЕАЛЬНУЮ ошибку источника (challenge/auth/rate-limit/http-провал)
                // и штатный конец данных. Ошибку НЕ проглатываем — бросаем исключение, чтобы
                // catch в handle() пометил parse_run как failed с понятным сообщением. Пустой
                // источник без признаков ошибки — мягкий выход с уже собранным kept.
                $this->failOnSourceError(is_array($result) ? $result : null);

                break;
            }

            $pageCandidates = $result['candidates'] ?? [];
            $scannedCount += count($pageCandidates);
            $cursor = $result['next_max_id'] ?? null;
            $pageTargets = [];

            foreach ($pageCandidates as $candidate) {
                $userPk = (string) ($candidate['user_pk'] ?? '');

                if ($userPk === '' || isset($seen[$userPk])) {
                    continue;
                }

                if (!$this->passesFollowerPrefilter($candidate, $filters)) {
                    continue;
                }

                $seen[$userPk] = true;
                $pageTargets[] = $candidate;
            }

            foreach (array_chunk($pageTargets, self::ENRICH_BATCH) as $batch) {
                if ($kept >= $targetLimit) {
                    break;
                }

                $enrichResult = $instagramClient->parseTargetsEnrich([
                    'session_data'       => $sessionData,
                    'account_id'         => $accountId,
                    'targets'            => array_values($batch),
                    'last_n'             => $this->lastN($filters),
                    'include_user_media' => true
                ], $userId);

                if (empty($enrichResult['success'])) {
                    // Фатальные коды (challenge/login) на enrich — тоже не молчим: при потере
                    // сессии дальнейший сбор бессмыслен и пользователь должен видеть причину.
                    // Прочие сбои отдельного батча не валят прогон — мягко пропускаем.
                    $this->failOnFatalError(is_array($enrichResult) ? $enrichResult : null);

                    continue;
                }

                $enriched = $enrichResult['targets'] ?? [];
                $verdicts = $targetFilter->applyFilters($enriched, $filters);

                foreach ($verdicts as $verdict) {
                    if ($kept >= $targetLimit) {
                        break;
                    }

                    if (empty($verdict['passed'])) {
                        continue;
                    }

                    $target = $verdict['target'];

                    if ($isLikeAction && $this->shouldSkipLikeTarget($target, $alreadyActionedMediaPkSet)) {
                        continue;
                    }

                    $data = $this->buildTargetData($target, $this->parseRunId, $userId);

                    if ($data === null) {
                        continue;
                    }

                    $parsedTargetRepository->create($data);
                    $kept++;

                    $mediaPk = $data['media_pk'] ?? null;

                    if ($isLikeAction && is_string($mediaPk) && $mediaPk !== '') {
                        $alreadyActionedMediaPkSet[$mediaPk] = true;
                    }
                }

                $this->broadcastProgress($this->parseRunId, 'running', $kept);
            }

            if ($cursor === null) {
                break;
            }
        }

        return $kept;
    }

    /**
     * @return array<string, bool>
     */
    private function alreadyActionedMediaPkSet(int $accountId): array {
        $mediaPks = AutomationActionItem::where('instagram_account_id', $accountId)
            ->where('action_type', 'like')
            ->whereNotNull('media_pk')
            ->pluck('media_pk')
            ->map(static fn (mixed $mediaPk): string => (string) $mediaPk)
            ->all();

        return array_fill_keys($mediaPks, true);
    }

    /**
     * @param array<string, mixed> $target
     * @param array<string, bool> $alreadyActionedMediaPkSet
     */
    private function shouldSkipLikeTarget(array $target, array $alreadyActionedMediaPkSet): bool {
        $anchor = is_array($target['anchor_post'] ?? null) ? $target['anchor_post'] : [];

        if (($anchor['has_liked'] ?? null) === true) {
            return true;
        }

        $mediaPk = (string) ($anchor['pk'] ?? '');

        return $mediaPk !== '' && isset($alreadyActionedMediaPkSet[$mediaPk]);
    }

    private function collectFollowingTargets(
        InstagramClientServiceInterface $instagramClient,
        ParsedTargetRepositoryInterface $parsedTargetRepository,
        string $sessionData,
        int $accountId,
        int $userId,
        int $targetLimit,
        ?int &$scannedCount
    ): int {
        $result = $instagramClient->getFollowing($sessionData, $accountId, $targetLimit, $userId);

        if (empty($result['success'])) {
            $this->failOnSourceError(is_array($result) ? $result : null);

            throw new \RuntimeException('Не удалось получить список подписок');
        }

        $users        = array_slice($result['users'] ?? [], 0, $targetLimit);
        $scannedCount = count($users);
        $kept         = 0;

        foreach ($users as $user) {
            $data = $this->buildFollowingTargetData($user, $this->parseRunId, $userId);

            if ($data === null) {
                continue;
            }

            $parsedTargetRepository->create($data);
            $kept++;
            $this->broadcastProgress($this->parseRunId, 'running', $kept);
        }

        return $kept;
    }

    /**
     * Дешёвый пред-отсев по follower_count из ответа источника (если доступен).
     *
     * @param array<string, mixed> $candidate
     * @param array<string, mixed> $filters
     */
    private function passesFollowerPrefilter(array $candidate, array $filters): bool {
        $anchorUser = $candidate['anchor_post']['user'] ?? [];
        $followers  = $anchorUser['follower_count'] ?? null;

        if (!is_numeric($followers)) {
            return true;
        }

        $followers = (int) $followers;
        $min       = $filters['followers_min'] ?? null;
        $max       = $filters['followers_max'] ?? null;

        if ($min !== null && $min !== '' && $followers < (int) $min) {
            return false;
        }

        if ($max !== null && $max !== '' && $followers > (int) $max) {
            return false;
        }

        return true;
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function lastN(array $filters): int {
        $value = $filters['last_n'] ?? null;

        return is_numeric($value) ? (int) $value : 6;
    }

    /**
     * @param array<string, mixed> $target
     * @return array<string, mixed>|null
     */
    private function buildTargetData(array $target, int $parseRunId, int $userId): ?array {
        $user   = is_array($target['user'] ?? null) ? $target['user'] : [];
        $anchor = is_array($target['anchor_post'] ?? null) ? $target['anchor_post'] : [];

        $userPk  = (string) ($target['user_pk'] ?? $user['pk'] ?? '');
        $mediaPk = (string) ($anchor['pk'] ?? '');

        if ($userPk === '') {
            return null;
        }

        $mediaId = $mediaPk !== '' ? "{$mediaPk}_{$userPk}" : null;

        $takenAtRaw = $anchor['taken_at'] ?? null;
        $takenAt    = is_string($takenAtRaw) && $takenAtRaw !== '' ? $takenAtRaw : null;

        $metrics   = is_array($target['metrics'] ?? null) ? $target['metrics'] : [];
        $thumbnail = $anchor['thumbnail_url'] ?? null;

        $metricsSnapshot = [
            'likes_sum'          => $metrics['likes_sum_last_n'] ?? 0,
            'likes_avg'          => $metrics['likes_avg_last_n'] ?? 0,
            'likes_min'          => $metrics['likes_min'] ?? 0,
            'likes_max'          => $metrics['likes_max'] ?? 0,
            'last_post_age_days' => $metrics['last_post_age_days'] ?? null,
            'posts_analyzed'     => $metrics['posts_analyzed'] ?? 0,
            'captions_concat'    => $metrics['captions_concat'] ?? '',
            'media_thumbnail_url' => $thumbnail
        ];

        return [
            'parse_run_id'           => $parseRunId,
            'user_id'                => $userId,
            'target_user_pk'         => $userPk,
            'target_username'        => $user['username'] ?? ($target['username'] ?? null),
            'target_full_name'       => $user['full_name'] ?? null,
            'target_profile_pic_url' => $user['profile_pic_url'] ?? null,
            'follower_count'         => (int) ($user['follower_count'] ?? 0),
            'following_count'        => (int) ($user['following_count'] ?? 0),
            'media_count'            => (int) ($user['media_count'] ?? 0),
            'is_private'             => (bool) ($user['is_private'] ?? false),
            'is_verified'            => (bool) ($user['is_verified'] ?? false),
            'media_pk'               => $mediaPk !== '' ? $mediaPk : null,
            'media_id'               => $mediaId,
            'media_caption'          => $anchor['caption_text'] ?? null,
            'media_like_count'       => (int) ($anchor['like_count'] ?? 0),
            'media_comment_count'    => (int) ($anchor['comment_count'] ?? 0),
            'media_taken_at'         => $takenAt,
            'media_thumbnail_url'    => $thumbnail,
            'metrics_snapshot'       => $metricsSnapshot,
            'status'                 => 'kept'
        ];
    }

    /**
     * @param array<string, mixed> $user
     * @return array<string, mixed>|null
     */
    private function buildFollowingTargetData(array $user, int $parseRunId, int $userId): ?array {
        $userPk   = (string) ($user['user_pk'] ?? '');
        $username = (string) ($user['username'] ?? '');

        if ($userPk === '' || $username === '') {
            return null;
        }

        return [
            'parse_run_id'           => $parseRunId,
            'user_id'                => $userId,
            'target_user_pk'         => $userPk,
            'target_username'        => $username,
            'target_full_name'       => $user['full_name'] ?? null,
            'target_profile_pic_url' => $user['profile_pic_url'] ?? null,
            'follower_count'         => null,
            'following_count'        => null,
            'media_count'            => null,
            'is_private'             => false,
            'is_verified'            => false,
            'media_pk'               => null,
            'media_id'               => null,
            'media_caption'          => null,
            'media_like_count'       => null,
            'media_comment_count'    => null,
            'media_taken_at'         => null,
            'media_thumbnail_url'    => null,
            'metrics_snapshot'       => [],
            'status'                 => 'kept'
        ];
    }

    private function broadcastProgress(int $parseRunId, string $status, int $kept, ?string $errorMessage = null): void {
        if (!class_exists('App\Events\AutomationTaskProgress')) {
            return;
        }

        $task = \App\Models\AutomationTask::where('parse_run_id', $parseRunId)->first();

        $task !== null && broadcast(new \App\Events\AutomationTaskProgress(
            (int) $task->id,
            $status,
            $kept,
            0,
            0,
            0,
            'parsing',
            $errorMessage
        ));
    }

    private function scheduleFullAutoTask(ParseRun $parseRun): void {
        if ($parseRun->mode !== 'full_auto') {
            return;
        }

        $task = AutomationTask::where('parse_run_id', $parseRun->id)->first();

        if ($task === null || $task->mode !== 'full_auto') {
            return;
        }

        ScheduleActionItemsJob::dispatch((int) $task->id);
    }
}
