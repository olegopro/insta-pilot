<?php

declare(strict_types=1);

namespace Tests\Feature\Feed;

use App\Models\InstagramAccount;
use App\Models\User;
use App\Services\InstagramClientServiceInterface;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class FeedTest extends TestCase {
    private User $user;
    private InstagramAccount $account;

    /** Минимальный успешный ответ от Python /account/feed */
    private array $feedResponse = [
        'success'        => true,
        'posts'          => [
            ['pk' => '111', 'media_type' => 1, 'user' => ['username' => 'alice']],
            ['pk' => '222', 'media_type' => 1, 'user' => ['username' => 'bob']],
        ],
        'next_max_id'    => 'cursor-abc',
        'more_available' => true,
    ];

    protected function setUp(): void {
        parent::setUp();
        $this->user    = User::factory()->create();
        $this->account = InstagramAccount::factory()->create([
            'user_id'      => $this->user->id,
            'session_data' => '{"uuids":{},"cookies":{},"last_login":0,"device_settings":{},"user_agent":"","country":"US","country_code":1,"locale":"en_US","timezone_offset":0,"authorization_data":{}}',
        ]);
    }

    public function test_index_returns_feed_posts(): void {
        $this->mock(InstagramClientServiceInterface::class)
            ->shouldReceive('getFeed')
            ->andReturn($this->feedResponse);

        $response = $this->actingAs($this->user)
            ->getJson("/api/feed/{$this->account->id}");

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.posts.0.pk', '111')
            ->assertJsonPath('data.next_max_id', 'cursor-abc')
            ->assertJsonPath('data.more_available', true);
    }

    public function test_index_pagination_passes_max_id(): void {
        $mock = $this->mock(InstagramClientServiceInterface::class);
        $mock->shouldReceive('getFeed')
            ->withArgs(fn ($session, $id, $maxId) => $maxId === 'cursor-xyz')
            ->andReturn($this->feedResponse);

        $this->actingAs($this->user)
            ->getJson("/api/feed/{$this->account->id}?max_id=cursor-xyz")
            ->assertStatus(200);
    }

    public function test_index_returns_404_for_nonexistent_account(): void {
        $this->actingAs($this->user)
            ->getJson('/api/feed/99999')
            ->assertStatus(404)
            ->assertJsonPath('success', false);
    }

    public function test_index_returns_404_for_other_users_account(): void {
        $other   = User::factory()->create();
        $account = InstagramAccount::factory()->create(['user_id' => $other->id]);

        // InstagramClient не должен вызываться
        $this->mock(InstagramClientServiceInterface::class)
            ->shouldNotReceive('getFeed');

        $this->actingAs($this->user)
            ->getJson("/api/feed/{$account->id}")
            ->assertStatus(404);
    }

    public function test_index_returns_422_for_account_without_session(): void {
        $account = InstagramAccount::factory()->create([
            'user_id'      => $this->user->id,
            'session_data' => null,
        ]);

        $this->actingAs($this->user)
            ->getJson("/api/feed/{$account->id}")
            ->assertStatus(422);
    }

    public function test_like_returns_success(): void {
        $this->mock(InstagramClientServiceInterface::class)
            ->shouldReceive('addLike')
            ->andReturn(['success' => true]);

        $this->actingAs($this->user)
            ->postJson("/api/feed/{$this->account->id}/like", ['media_id' => '12345_67890'])
            ->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_like_returns_422_without_media_id(): void {
        $this->actingAs($this->user)
            ->postJson("/api/feed/{$this->account->id}/like", [])
            ->assertStatus(422);
    }

    public function test_feed_requires_auth(): void {
        $this->getJson("/api/feed/{$this->account->id}")
            ->assertStatus(401);
    }

    public function test_inactive_user_gets_403(): void {
        $inactive = User::factory()->inactive()->create();
        $account  = InstagramAccount::factory()->create(['user_id' => $inactive->id]);

        $this->actingAs($inactive)
            ->getJson("/api/feed/{$account->id}")
            ->assertStatus(403);
    }
}
