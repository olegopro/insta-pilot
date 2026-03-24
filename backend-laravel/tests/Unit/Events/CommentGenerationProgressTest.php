<?php

declare(strict_types=1);

namespace Tests\Unit\Events;

use App\Events\CommentGenerationProgress;
use Illuminate\Broadcasting\PrivateChannel;
use Tests\TestCase;

class CommentGenerationProgressTest extends TestCase {
    public function test_broadcast_on_returns_private_channel_with_job_id(): void {
        $event   = new CommentGenerationProgress('job-abc', 'downloading');
        $channel = $event->broadcastOn();

        $this->assertInstanceOf(PrivateChannel::class, $channel);
        $this->assertEquals('private-comment-generation.job-abc', $channel->name);
    }

    public function test_broadcast_with_contains_required_fields(): void {
        $event   = new CommentGenerationProgress('job-abc', 'completed', comment: 'Nice!', error: null);
        $payload = $event->broadcastWith();

        $this->assertEquals('job-abc', $payload['job_id']);
        $this->assertEquals('completed', $payload['step']);
        $this->assertEquals('Nice!', $payload['comment']);
        $this->assertNull($payload['error']);
    }

    public function test_broadcast_as_returns_correct_name(): void {
        $event = new CommentGenerationProgress('id', 'analyzing');

        $this->assertEquals('CommentGenerationProgress', $event->broadcastAs());
    }
}
