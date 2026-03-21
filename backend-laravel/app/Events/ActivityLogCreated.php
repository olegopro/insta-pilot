<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\AccountActivityLog;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class ActivityLogCreated implements ShouldBroadcastNow {
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        public readonly AccountActivityLog $log,
    ) {}

    public function broadcastOn(): array {
        return [
            new PrivateChannel("account-activity.{$this->log->instagram_account_id}"),
            new PrivateChannel("activity-global.{$this->log->user_id}"),
        ];
    }

    public function broadcastWith(): array {
        return [
            'id'                   => $this->log->id,
            'instagram_account_id' => $this->log->instagram_account_id,
            'instagram_login'      => $this->log->instagramAccount?->instagram_login,
            'user_id'              => $this->log->user_id,
            'action'               => $this->log->action,
            'status'               => $this->log->status,
            'http_code'            => $this->log->http_code,
            'endpoint'             => $this->log->endpoint,
            'response_summary'     => $this->log->response_summary,
            'error_message'        => $this->log->error_message,
            'error_code'           => $this->log->error_code,
            'duration_ms'          => $this->log->duration_ms,
            'created_at'           => $this->log->created_at->toISOString(),
        ];
    }

    public function broadcastAs(): string {
        return 'ActivityLogCreated';
    }
}
