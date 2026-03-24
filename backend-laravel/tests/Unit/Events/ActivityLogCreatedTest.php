<?php

declare(strict_types=1);

namespace Tests\Unit\Events;

use App\Events\ActivityLogCreated;
use App\Models\AccountActivityLog;
use App\Models\InstagramAccount;
use App\Models\User;
use Illuminate\Broadcasting\PrivateChannel;
use Tests\TestCase;

class ActivityLogCreatedTest extends TestCase {
    private AccountActivityLog $log;

    protected function setUp(): void {
        parent::setUp();
        $account   = InstagramAccount::factory()->create();
        $user      = User::factory()->create();
        $this->log = AccountActivityLog::factory()->create([
            'instagram_account_id' => $account->id,
            'user_id'              => $user->id,
        ]);
    }

    public function test_broadcast_on_returns_two_private_channels(): void {
        $event    = new ActivityLogCreated($this->log);
        $channels = $event->broadcastOn();

        $this->assertCount(2, $channels);
        $this->assertInstanceOf(PrivateChannel::class, $channels[0]);
        $this->assertInstanceOf(PrivateChannel::class, $channels[1]);

        $names = array_map(fn (PrivateChannel $c) => $c->name, $channels);
        $this->assertContains("private-account-activity.{$this->log->instagram_account_id}", $names);
        $this->assertContains("private-activity-global.{$this->log->user_id}", $names);
    }

    public function test_broadcast_with_contains_required_fields(): void {
        $event   = new ActivityLogCreated($this->log);
        $payload = $event->broadcastWith();

        foreach (['id', 'instagram_account_id', 'user_id', 'action', 'status', 'created_at'] as $field) {
            $this->assertArrayHasKey($field, $payload);
        }
        $this->assertEquals($this->log->id, $payload['id']);
        $this->assertEquals($this->log->action, $payload['action']);
    }

    public function test_broadcast_as_returns_correct_name(): void {
        $event = new ActivityLogCreated($this->log);

        $this->assertEquals('ActivityLogCreated', $event->broadcastAs());
    }
}
