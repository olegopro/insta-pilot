<?php

declare(strict_types=1);

namespace Tests\Feature\Comment;

use App\Models\InstagramAccount;
use App\Models\User;
use App\Services\InstagramClientServiceInterface;
use Tests\TestCase;

class CommentTest extends TestCase {
    private User $user;
    private InstagramAccount $account;
    private string $sessionData = '{"uuids":{},"cookies":{},"last_login":0,"device_settings":{},"user_agent":"","country":"US","country_code":1,"locale":"en_US","timezone_offset":0,"authorization_data":{}}';

    protected function setUp(): void {
        parent::setUp();
        $this->user    = User::factory()->create();
        $this->account = InstagramAccount::factory()->create([
            'user_id'      => $this->user->id,
            'session_data' => $this->sessionData,
        ]);
    }

    public function test_index_returns_comments(): void {
        $this->mock(InstagramClientServiceInterface::class)
            ->shouldReceive('fetchMediaComments')
            ->andReturn([
                'success'       => true,
                'comments'      => [
                    ['pk' => 'c1', 'text' => 'Hello', 'user' => ['username' => 'alice']],
                ],
                'comment_count' => 1,
                'next_min_id'   => null,
            ]);

        $this->actingAs($this->user)
            ->getJson("/api/media/comments?account_id={$this->account->id}&media_pk=12345")
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.comments.0.pk', 'c1');
    }

    public function test_index_pagination_with_min_id(): void {
        $mock = $this->mock(InstagramClientServiceInterface::class);
        $mock->shouldReceive('fetchMediaComments')
            ->withArgs(fn ($s, $id, $pk, $minId) => $minId === 'cursor-min')
            ->andReturn(['success' => true, 'comments' => [], 'comment_count' => 0, 'next_min_id' => null]);

        $this->actingAs($this->user)
            ->getJson("/api/media/comments?account_id={$this->account->id}&media_pk=12345&min_id=cursor-min")
            ->assertStatus(200);
    }

    public function test_replies_returns_child_comments(): void {
        $this->mock(InstagramClientServiceInterface::class)
            ->shouldReceive('fetchCommentReplies')
            ->andReturn([
                'success'             => true,
                'child_comments'      => [
                    ['pk' => 'r1', 'text' => 'Reply!', 'user' => ['username' => 'bob']],
                ],
                'child_comment_count' => 1,
            ]);

        $this->actingAs($this->user)
            ->getJson("/api/media/comments/replies?account_id={$this->account->id}&media_pk=12345&comment_pk=c1")
            ->assertStatus(200)
            ->assertJsonPath('data.child_comments.0.pk', 'r1');
    }

    public function test_store_posts_comment(): void {
        $this->mock(InstagramClientServiceInterface::class)
            ->shouldReceive('commentMedia')
            ->andReturn(['success' => true, 'comment_pk' => 'pk-999']);

        $this->actingAs($this->user)
            ->postJson("/api/media/12345/comment", [
                'account_id' => $this->account->id,
                'text'       => 'Great post!',
            ])
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.comment_pk', 'pk-999');
    }

    public function test_store_requires_text(): void {
        $this->actingAs($this->user)
            ->postJson("/api/media/12345/comment", ['account_id' => $this->account->id])
            ->assertStatus(422);
    }

    public function test_returns_404_for_other_users_account(): void {
        $other   = User::factory()->create();
        $account = InstagramAccount::factory()->create(['user_id' => $other->id]);

        $this->actingAs($this->user)
            ->getJson("/api/media/comments?account_id={$account->id}&media_pk=12345")
            ->assertStatus(404);
    }

    public function test_requires_auth(): void {
        $this->getJson("/api/media/comments?account_id={$this->account->id}&media_pk=12345")
            ->assertStatus(401);
    }

    public function test_inactive_user_gets_403(): void {
        $inactive = User::factory()->inactive()->create();
        $account  = InstagramAccount::factory()->create(['user_id' => $inactive->id]);

        $this->actingAs($inactive)
            ->getJson("/api/media/comments?account_id={$account->id}&media_pk=12345")
            ->assertStatus(403);
    }
}
