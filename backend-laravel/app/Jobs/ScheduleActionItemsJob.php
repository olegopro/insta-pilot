<?php

declare(strict_types=1);

namespace App\Jobs;

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
        public readonly int $taskId
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

        $scheduler->scheduleTask($task);
    }
}
