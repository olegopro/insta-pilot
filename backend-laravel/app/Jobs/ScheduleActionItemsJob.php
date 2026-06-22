<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Events\AutomationTaskProgress;
use App\Models\AutomationTask;
use App\Services\Automation\ActionSchedulerServiceInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

final class ScheduleActionItemsJob implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 1;
    public int $timeout = 60;

    public function __construct(
        public readonly int $taskId,
        public readonly ?array $offsets = null
    ) {
        $this->onQueue('automation');
    }

    public function handle(ActionSchedulerServiceInterface $scheduler): void {
        $task = AutomationTask::find($this->taskId);

        if ($task === null || in_array($task->status, [
            'paused',
            'cancelled'
        ], true)) {
            return;
        }

        $scheduler->scheduleTask($task, $this->offsets);

        // Планировщик меняет статус задачи (draft/scheduling → running/completed) асинхронно.
        // Шлём прогресс, чтобы список задач на фронте обновился realtime, а не завис на «Черновик».
        $task->refresh();

        broadcast(new AutomationTaskProgress(
            $task->id,
            $task->status,
            $task->items_total,
            $task->items_done,
            $task->items_failed,
            $task->items_skipped
        ));
    }
}
