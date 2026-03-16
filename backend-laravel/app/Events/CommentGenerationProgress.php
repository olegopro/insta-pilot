<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class CommentGenerationProgress implements ShouldBroadcastNow {
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        public readonly string $jobId,
        public readonly string $step,
        public readonly ?string $comment = null,
        public readonly ?string $error = null
    ) {}

    public function broadcastOn(): PrivateChannel {
        return new PrivateChannel("comment-generation.{$this->jobId}");
    }

    public function broadcastWith(): array {
        return [
            'job_id'  => $this->jobId,
            'step'    => $this->step,
            'comment' => $this->comment,
            'error'   => $this->error
        ];
    }

    public function broadcastAs(): string {
        return 'CommentGenerationProgress';
    }
}
