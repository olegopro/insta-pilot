<?php

declare(strict_types=1);

namespace App\Jobs;

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

class ParseTargetsJob implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 1;
    public int $timeout = 300;

    private const PAGE_AMOUNT = 30;
    private const MAX_PAGES = 30;
    private const ENRICH_BATCH = 20;
    private const OVERSAMPLE = 1.5;

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
            $targetLimit     = max(1, (int) $parseRun->target_limit);
            $oversampleLimit = (int) ceil($targetLimit * self::OVERSAMPLE);

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

            $candidates = $this->collectCandidates(
                $instagramClient,
                (string) $account->session_data,
                $accountId,
                $userId,
                (string) $parseRun->source_type,
                $sourceValue,
                $filters,
                $oversampleLimit,
                $scannedCount
            );

            $kept = 0;

            foreach (array_chunk($candidates, self::ENRICH_BATCH) as $batch) {
                if ($kept >= $targetLimit) {
                    break;
                }

                $enrichResult = $instagramClient->parseTargetsEnrich([
                    'session_data'       => (string) $account->session_data,
                    'account_id'         => $accountId,
                    'targets'            => array_values($batch),
                    'last_n'             => $this->lastN($filters),
                    'include_user_media' => true
                ], $userId);

                if (empty($enrichResult['success'])) {
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

                    $data = $this->buildTargetData($verdict['target'], $this->parseRunId, $userId);

                    if ($data === null) {
                        continue;
                    }

                    $parsedTargetRepository->create($data);
                    $kept++;
                }

                $this->broadcastProgress($this->parseRunId, 'running', $kept);
            }

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

            $this->broadcastProgress($this->parseRunId, 'failed', 0);

            throw $e;
        }
    }

    /**
     * Собирает уникальных кандидатов страницами с дешёвым follower-пред-отсевом.
     *
     * @param array<string, mixed> $sourceValue
     * @param array<string, mixed> $filters
     * @return array<int, array<string, mixed>>
     */
    private function collectCandidates(
        InstagramClientServiceInterface $instagramClient,
        string $sessionData,
        int $accountId,
        int $userId,
        string $sourceType,
        array $sourceValue,
        array $filters,
        int $oversampleLimit,
        ?int &$scannedCount
    ): array {
        $scannedCount = 0;
        $collected    = [];
        $seen         = [];
        $cursor       = null;
        $page         = 0;

        while ($page < self::MAX_PAGES && count($collected) < $oversampleLimit) {
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
                break;
            }

            $pageCandidates = $result['candidates'] ?? [];
            $scannedCount += count($pageCandidates);

            foreach ($pageCandidates as $candidate) {
                $userPk = (string) ($candidate['user_pk'] ?? '');

                if ($userPk === '' || isset($seen[$userPk])) {
                    continue;
                }

                if (!$this->passesFollowerPrefilter($candidate, $filters)) {
                    continue;
                }

                $seen[$userPk] = true;
                $collected[]   = $candidate;

                if (count($collected) >= $oversampleLimit) {
                    break;
                }
            }

            $cursor = $result['next_max_id'] ?? null;

            if ($cursor === null) {
                break;
            }
        }

        return $collected;
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
            throw new \RuntimeException((string) ($result['error'] ?? 'Не удалось получить список подписок'));
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

    private function broadcastProgress(int $parseRunId, string $status, int $kept): void {
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
            'parsing'
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
