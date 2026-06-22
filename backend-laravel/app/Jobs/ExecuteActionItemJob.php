<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Events\AutomationTaskProgress;
use App\Models\AccountActivityLog;
use App\Models\AccountTargetInteraction;
use App\Models\AutomationActionItem;
use App\Models\AutomationTask;
use App\Services\Automation\ActionPluginRegistryInterface;
use App\Services\Automation\RateLimitGuardServiceInterface;
use App\Services\Automation\WorkingHoursServiceInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

final class ExecuteActionItemJob implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 1;
    public int $timeout;

    public function __construct(
        public readonly int $itemId,
        public readonly string $actionType = 'comment'
    ) {
        $this->timeout = $this->actionType === 'comment' ? 120 : 90;
        $this->onQueue('automation');
    }

    public function handle(
        ActionPluginRegistryInterface $plugins,
        RateLimitGuardServiceInterface $rateLimitGuard,
        WorkingHoursServiceInterface $workingHours
    ): void {
        $item = $this->loadItem();

        if ($item === null || in_array($item->automationTask->status, [
            'paused',
            'cancelled'
        ], true)) {
            return;
        }

        $account = $item->instagramAccount;
        $task = $item->automationTask;
        $plugin = $plugins->get($item->action_type);
        $reserved = false;
        $instagramAttempted = false;

        try {
            $reserved = $rateLimitGuard->reserve($account, $plugin->limitKey(), $item);

            if (!$reserved) {
                $this->markSkipped($item, 'skip_limit', 'Daily automation limit reached.');
                $this->refreshTaskProgress($task, $item->action_type);

                return;
            }

            if ($task->respect_working_hours && !$workingHours->isOpenNow($account)) {
                $rateLimitGuard->release($account, $plugin->limitKey(), $item);
                $reserved = false;
                $this->reschedule($item, $workingHours->nextOpenSlot($account, now()), 'skip_hours');
                $this->refreshTaskProgress($task, $item->action_type);

                return;
            }

            $claimToken = (string) Str::uuid();

            if (!$this->claim($item, $claimToken)) {
                $rateLimitGuard->release($account, $plugin->limitKey(), $item);

                return;
            }

            $item = $this->loadItem();

            if ($item === null) {
                return;
            }

            $resolved = $plugin->resolve($item);
            $instagramAttempted = true;
            $result = $plugin->execute($account, $resolved, (int) $task->user_id);

            $this->handleResult($item, $result, $rateLimitGuard, $plugin->limitKey(), $reserved, $instagramAttempted);
            $this->refreshTaskProgress($task, $item->action_type);
        } catch (Throwable $throwable) {
            if ($reserved && !$instagramAttempted) {
                $rateLimitGuard->release($account, $plugin->limitKey(), $item);
            }

            $this->markFailed($item, $this->errorCode($throwable), $throwable->getMessage());
            $this->refreshTaskProgress($task, $item->action_type);
        }
    }

    private function loadItem(): AutomationActionItem | null {
        return AutomationActionItem::with([
            'automationTask',
            'instagramAccount',
            'parsedTarget'
        ])->find($this->itemId);
    }

    private function claim(AutomationActionItem $item, string $claimToken): bool {
        return AutomationActionItem::whereKey($item->id)
            ->where('status', 'scheduled')
            ->update([
                'status' => 'running',
                'claim_token' => $claimToken,
                'claimed_at' => now(),
                'claim_expires_at' => now()->addSeconds($this->timeout + 60),
                'attempts' => DB::raw('attempts + 1'),
                'updated_at' => now()
            ]) > 0;
    }

    /**
     * @param array<string, mixed> $result
     */
    private function handleResult(
        AutomationActionItem $item,
        array $result,
        RateLimitGuardServiceInterface $rateLimitGuard,
        string $limitKey,
        bool $reserved,
        bool $instagramAttempted
    ): void {
        if (($result['success'] ?? false) === true) {
            $this->markDone($item, $result, $this->latestActivityLogId($item));
            $this->touchCooldown($item);

            return;
        }

        $errorCode = (string) ($result['error_code'] ?? 'instagram_error');
        $errorMessage = (string) ($result['error'] ?? 'Instagram action failed.');

        if (in_array($errorCode, [
            'media_not_found',
            'user_private'
        ], true)) {
            $reserved && $rateLimitGuard->release($item->instagramAccount, $limitKey, $item);
            $this->markSkipped($item, 'target_gone', $errorMessage);

            return;
        }

        if (in_array($errorCode, [
            'rate_limited',
            'feedback_required'
        ], true)) {
            $reserved && $rateLimitGuard->release($item->instagramAccount, $limitKey, $item);
            $this->backoffAccount($item);
            $this->markFailed($item, $errorCode, $errorMessage);

            return;
        }

        if (in_array($errorCode, [
            'login_required',
            'challenge_required'
        ], true)) {
            $reserved && $rateLimitGuard->release($item->instagramAccount, $limitKey, $item);
            $this->pauseAccountTasks($item);
            $this->markFailed($item, $errorCode, $errorMessage);

            return;
        }

        if (!$instagramAttempted && $reserved) {
            $rateLimitGuard->release($item->instagramAccount, $limitKey, $item);
        }

        $this->markFailed($item, $errorCode, $errorMessage);
    }

    private function reschedule(AutomationActionItem $item, \DateTimeInterface $runAt, string $errorCode): void {
        AutomationActionItem::whereKey($item->id)->update([
            'status' => 'scheduled',
            'run_at' => $runAt,
            'claim_token' => null,
            'claimed_at' => null,
            'claim_expires_at' => null,
            'error_code' => $errorCode,
            'error_message' => null,
            'updated_at' => now()
        ]);
    }

    private function markDone(AutomationActionItem $item, array $result, ?int $activityLogId): void {
        AutomationActionItem::whereKey($item->id)->update([
            'status' => 'done',
            'result' => $result,
            'activity_log_id' => $activityLogId,
            'claim_token' => null,
            'claimed_at' => null,
            'claim_expires_at' => null,
            'error_code' => null,
            'error_message' => null,
            'executed_at' => now(),
            'updated_at' => now()
        ]);
    }

    private function markFailed(AutomationActionItem $item, ?string $errorCode, ?string $errorMessage): void {
        AutomationActionItem::whereKey($item->id)->update([
            'status' => 'failed',
            'claim_token' => null,
            'claimed_at' => null,
            'claim_expires_at' => null,
            'error_code' => $errorCode,
            'error_message' => $errorMessage,
            'executed_at' => now(),
            'updated_at' => now()
        ]);
    }

    private function markSkipped(AutomationActionItem $item, string $errorCode, ?string $errorMessage): void {
        AutomationActionItem::whereKey($item->id)->update([
            'status' => 'skipped',
            'claim_token' => null,
            'claimed_at' => null,
            'claim_expires_at' => null,
            'error_code' => $errorCode,
            'error_message' => $errorMessage,
            'executed_at' => now(),
            'updated_at' => now()
        ]);
    }

    private function backoffAccount(AutomationActionItem $item): void {
        $delayMinutes = random_int(30, 60);

        AutomationActionItem::where('instagram_account_id', $item->instagram_account_id)
            ->where('status', 'scheduled')
            ->update([
                'run_at' => now()->addMinutes($delayMinutes),
                'updated_at' => now()
            ]);
    }

    private function pauseAccountTasks(AutomationActionItem $item): void {
        AutomationTask::where('instagram_account_id', $item->instagram_account_id)
            ->where('status', 'running')
            ->update([
                'status' => 'paused',
                'updated_at' => now()
            ]);
    }

    private function touchCooldown(AutomationActionItem $item): void {
        AccountTargetInteraction::updateOrCreate(
            [
                'instagram_account_id' => $item->instagram_account_id,
                'target_user_pk' => $item->target_user_pk,
                'action' => $item->action_type
            ],
            ['last_touched_at' => now()]
        );
    }

    private function latestActivityLogId(AutomationActionItem $item): ?int {
        return AccountActivityLog::where('instagram_account_id', $item->instagram_account_id)
            ->where('user_id', $item->user_id)
            ->where('action', $item->action_type)
            ->orderByDesc('id')
            ->value('id');
    }

    private function refreshTaskProgress(AutomationTask $task, string $currentAction): void {
        $itemsDone = AutomationActionItem::where('automation_task_id', $task->id)->where('status', 'done')->count();
        $itemsFailed = AutomationActionItem::where('automation_task_id', $task->id)->where('status', 'failed')->count();
        $itemsSkipped = AutomationActionItem::where('automation_task_id', $task->id)->where('status', 'skipped')->count();
        $terminal = $itemsDone + $itemsFailed + $itemsSkipped;
        $status = $task->status;

        if ($task->items_total > 0 && $terminal >= $task->items_total && $status === 'running') {
            $status = $itemsFailed > 0 ? 'failed' : 'completed';
        }

        $task->forceFill([
            'items_done' => $itemsDone,
            'items_failed' => $itemsFailed,
            'items_skipped' => $itemsSkipped,
            'status' => $status,
            'finished_at' => in_array($status, [
                'completed',
                'failed'
            ], true) ? now() : $task->finished_at
        ])->save();

        broadcast(new AutomationTaskProgress(
            (int) $task->id,
            $status,
            (int) $task->items_total,
            $itemsDone,
            $itemsFailed,
            $itemsSkipped,
            in_array($status, [
                'completed',
                'failed'
            ], true) ? null : $currentAction
        ));
    }

    private function errorCode(Throwable $throwable): string {
        $message = mb_strtolower($throwable->getMessage());

        return match (true) {
            str_contains($message, 'media_not_found') => 'media_not_found',
            str_contains($message, 'user_private') => 'user_private',
            str_contains($message, 'rate_limited') => 'rate_limited',
            str_contains($message, 'feedback_required') => 'feedback_required',
            str_contains($message, 'login_required') => 'login_required',
            str_contains($message, 'challenge_required') => 'challenge_required',
            default => 'automation_error'
        };
    }
}
