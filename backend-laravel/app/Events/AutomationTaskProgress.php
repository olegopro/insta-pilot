<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

final class AutomationTaskProgress implements ShouldBroadcastNow {
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        public readonly int $taskId,
        public readonly string $status,
        public readonly int $itemsTotal,
        public readonly int $itemsDone,
        public readonly int $itemsFailed,
        public readonly int $itemsSkipped,
        public readonly ?string $currentAction = null,
        public readonly ?string $errorMessage = null
    ) {}

    public function broadcastOn(): PrivateChannel {
        return new PrivateChannel("automation-task.{$this->taskId}");
    }

    public function broadcastWith(): array {
        return [
            'task_id' => $this->taskId,
            'status' => $this->status,
            'items_total' => $this->itemsTotal,
            'items_done' => $this->itemsDone,
            'items_failed' => $this->itemsFailed,
            'items_skipped' => $this->itemsSkipped,
            'current_action' => $this->currentAction,
            'error_message' => $this->errorMessage
        ];
    }

    public function broadcastAs(): string {
        return 'AutomationTaskProgress';
    }
}
