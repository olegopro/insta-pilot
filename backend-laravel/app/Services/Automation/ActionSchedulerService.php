<?php

declare(strict_types=1);

namespace App\Services\Automation;

use App\Models\AutomationActionItem;
use App\Models\AutomationTask;
use App\Models\ParsedTarget;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

final class ActionSchedulerService implements ActionSchedulerServiceInterface {
    public function __construct(
        private readonly WorkingHoursServiceInterface $workingHours
    ) {}

    public function scheduleTask(AutomationTask $task): void {
        DB::transaction(function () use ($task): void {
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

            $total = $targets->count();
            $now = Carbon::now();
            $spacing = $this->spacingSeconds($lockedTask, $total);
            $runAt = $now->copy()->subSeconds($spacing);
            $items = [];

            foreach ($targets as $index => $target) {
                $baseRunAt = $now->copy()->addSeconds($index * $spacing);
                $jitteredRunAt = $this->withJitter($baseRunAt, (int) ($lockedTask->jitter_seconds ?? 0));
                $runAt = $this->antiBurstSlot($jitteredRunAt, $runAt, $spacing);

                if ($lockedTask->respect_working_hours) {
                    $runAt = $this->workingHours->nextOpenSlot($lockedTask->instagramAccount, $runAt);
                }

                $items[] = $this->itemData($lockedTask, $target, $runAt);
            }

            if ($items !== []) {
                AutomationActionItem::insert($items);
            }

            $lockedTask->forceFill([
                'status' => 'running',
                'items_total' => $total,
                'items_done' => 0,
                'items_failed' => 0,
                'items_skipped' => 0,
                'started_at' => $lockedTask->started_at ?? now()
            ])->save();
        });
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
