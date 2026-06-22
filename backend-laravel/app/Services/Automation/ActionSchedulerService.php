<?php

declare(strict_types=1);

namespace App\Services\Automation;

use App\Models\AutomationActionItem;
use App\Models\AutomationTask;
use App\Models\ParsedTarget;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

final class ActionSchedulerService implements ActionSchedulerServiceInterface {
    private const MIN_GAP_SECONDS = 60;

    public function __construct(
        private readonly WorkingHoursServiceInterface $workingHours
    ) {}

    public function scheduleTask(AutomationTask $task, ?array $offsets = null): void {
        DB::transaction(function () use ($task, $offsets): void {
            $lockedTask = AutomationTask::whereKey($task->id)
                ->lockForUpdate()
                ->first();

            if ($lockedTask === null || in_array($lockedTask->status, [
                'paused',
                'cancelled'
            ], true)) {
                return;
            }

            if (AutomationActionItem::where('automation_task_id', $lockedTask->id)->exists()) {
                return;
            }

            $lockedTask->loadMissing('instagramAccount');

            $targets = ParsedTarget::where('parse_run_id', $lockedTask->parse_run_id)
                ->where('user_id', $lockedTask->user_id)
                ->where('status', 'kept')
                ->orderBy('id')
                ->limit($lockedTask->target_count)
                ->get();

            $keptTotal = $targets->count();

            // Отсеиваем цели, чьё media_pk уже имеет action-item у этого аккаунта с тем же
            // действием — иначе bulk-insert упирается в unique (account, action_type, media_pk)
            // и весь батч падает, а задача навсегда зависает в draft.
            $mediaPks = $targets->pluck('media_pk')->filter()->all();
            if ($mediaPks !== []) {
                $existing = AutomationActionItem::where('instagram_account_id', $lockedTask->instagram_account_id)
                    ->where('action_type', $lockedTask->action_type)
                    ->whereIn('media_pk', $mediaPks)
                    ->pluck('media_pk')
                    ->all();
                if ($existing !== []) {
                    $skip = array_flip($existing);
                    $targets = $targets
                        ->reject(fn (ParsedTarget $target): bool => $target->media_pk !== null && isset($skip[$target->media_pk]))
                        ->values();
                }
            }

            $total = $targets->count();
            $skipped = $keptTotal - $total;
            $now = Carbon::now();

            $items = ($offsets !== null && $offsets !== [])
                ? $this->buildItemsWithOffsets($lockedTask, $targets, $offsets, $now)
                : $this->buildItemsEven($lockedTask, $targets, $now);

            $inserted = $items === [] ? 0 : (int) AutomationActionItem::insertOrIgnore($items);

            $lockedTask->forceFill([
                'status' => $inserted === 0 ? 'completed' : 'running',
                'items_total' => $inserted,
                'items_done' => 0,
                'items_failed' => 0,
                'items_skipped' => $inserted === 0 ? $skipped : 0,
                'started_at' => $lockedTask->started_at ?? now(),
                'finished_at' => $inserted === 0 ? now() : $lockedTask->finished_at
            ])->save();
        });
    }

    /**
     * Равномерное распределение (текущее поведение): jitter + анти-burst + рабочие часы.
     *
     * @return array<int, array<string, mixed>>
     */
    private function buildItemsEven(AutomationTask $task, Collection $targets, Carbon $now): array {
        $spacing = $this->spacingSeconds($task, $targets->count());
        $runAt = $now->copy()->subSeconds($spacing);
        $items = [];

        foreach ($targets as $index => $target) {
            $baseRunAt = $now->copy()->addSeconds($index * $spacing);
            $jitteredRunAt = $this->withJitter($baseRunAt, (int) ($task->jitter_seconds ?? 0));
            $runAt = $this->antiBurstSlot($jitteredRunAt, $runAt, $spacing);

            if ($task->respect_working_hours) {
                $runAt = $this->workingHours->nextOpenSlot($task->instagramAccount, $runAt);
            }

            $items[] = $this->itemData($task, $target, $runAt);
        }

        return $items;
    }

    /**
     * Распределение по заданным пользователем смещениям. Ключ строго parsed_target_id
     * (дедуп-фильтр мог выкинуть часть целей); цели без ключа уходят на хвост по even-шагу.
     * БЕЗ jitter/анти-burst, но с enforce минимального зазора 60с и сортировкой по run_at.
     *
     * @param array<int, int> $offsets
     * @return array<int, array<string, mixed>>
     */
    private function buildItemsWithOffsets(AutomationTask $task, Collection $targets, array $offsets, Carbon $now): array {
        $spacing = $this->spacingSeconds($task, $targets->count());

        $keyed = [];
        foreach ($targets as $target) {
            if (isset($offsets[$target->id])) {
                $keyed[] = max(0, (int) $offsets[$target->id]);
            }
        }
        $tailCursor = ($keyed === [] ? 0 : max($keyed)) + $spacing;

        // Пары (target, offsetSeconds): keyed берут смещение из карты, остальные — на хвост.
        $pairs = [];
        foreach ($targets as $target) {
            if (isset($offsets[$target->id])) {
                $offsetSeconds = max(0, (int) $offsets[$target->id]);
            } else {
                $offsetSeconds = $tailCursor;
                $tailCursor += $spacing;
            }
            $pairs[] = [
                'target' => $target,
                'offset' => $offsetSeconds
            ];
        }

        usort($pairs, static fn (array $left, array $right): int => $left['offset'] <=> $right['offset']);

        $items = [];
        $previous = null;
        foreach ($pairs as $pair) {
            $runAt = $now->copy()->addSeconds($pair['offset']);

            if ($previous !== null) {
                $minRunAt = $previous->copy()->addSeconds(self::MIN_GAP_SECONDS);
                if ($runAt->lessThan($minRunAt)) {
                    $runAt = $minRunAt;
                }
            }

            if ($task->respect_working_hours) {
                $runAt = $this->workingHours->nextOpenSlot($task->instagramAccount, $runAt);
            }

            $previous = $runAt;
            $items[] = $this->itemData($task, $pair['target'], $runAt);
        }

        return $items;
    }

    private function spacingSeconds(AutomationTask $task, int $total): int {
        if ($total <= 1) {
            return max(60, (int) ($task->spread_seconds ?? 60));
        }

        return max(60, (int) floor((int) $task->spread_seconds / max(1, $total - 1)));
    }

    private function withJitter(Carbon $baseRunAt, int $jitterSeconds): Carbon {
        if ($jitterSeconds <= 0) {
            return $baseRunAt;
        }

        return $baseRunAt->copy()->addSeconds(random_int(-$jitterSeconds, $jitterSeconds));
    }

    private function antiBurstSlot(Carbon $candidate, Carbon $previous, int $spacingSeconds): Carbon {
        $minRunAt = $previous->copy()->addSeconds($spacingSeconds);

        return $candidate->lessThan($minRunAt) ? $minRunAt : $candidate;
    }

    /**
     * @return array<string, mixed>
     */
    private function itemData(AutomationTask $task, ParsedTarget $target, Carbon $runAt): array {
        $metrics = $target->metrics_snapshot ?? [];
        $payload = [
            'media_caption' => $target->media_caption,
            'target_username' => $target->target_username,
            'thumbnail_url' => $metrics['thumbnail_url'] ?? null,
            'image_url' => $metrics['image_url'] ?? $metrics['thumbnail_url'] ?? null,
            'action_config' => $task->action_config ?? []
        ];

        return [
            'automation_task_id' => $task->id,
            'instagram_account_id' => $task->instagram_account_id,
            'user_id' => $task->user_id,
            'parsed_target_id' => $target->id,
            'action_type' => $task->action_type,
            'target_user_pk' => $target->target_user_pk,
            'media_pk' => $target->media_pk,
            'media_id' => $target->media_id,
            'payload' => json_encode($payload, JSON_THROW_ON_ERROR),
            'status' => 'scheduled',
            'run_at' => $runAt,
            'created_at' => now(),
            'updated_at' => now()
        ];
    }
}
