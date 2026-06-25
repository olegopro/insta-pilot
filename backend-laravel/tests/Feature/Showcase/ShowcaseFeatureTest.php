<?php

declare(strict_types=1);

namespace Tests\Feature\Showcase;

use App\Models\InstagramAccount;
use App\Models\User;
use App\Services\InstagramClientServiceInterface;
use Tests\TestCase;

/**
 * Feature-тесты Витрины (Phase 1) — границы авторизации (401/403/404/ownership).
 *
 * ВНИМАНИЕ: требует роутов /api/showcase/*, которые добавляет оркестратор
 * (роуты правит параллельная задача). До их появления НЕ запускать —
 * исключён из изолированного прогона `--filter Showcase` по неймингу класса
 * (ShowcaseFeatureTest vs unit ShowcaseClientServiceTest пересекаются по фильтру,
 * поэтому при ручном прогоне используйте --filter ShowcaseClientServiceTest).
 *
 * Пути роутов ниже — ОЖИДАЕМЫЕ (assumption), синхронизировать с routes/api.php
 * после их добавления оркестратором.
 */
class ShowcaseFeatureTest extends TestCase {
    private User $user;
    private InstagramAccount $account;

    private array $profileResponse = [
        'success'         => true,
        'user_pk'         => '42',
        'username'        => 'me',
        'full_name'       => 'Me',
        'profile_pic_url' => 'https://example.test/a.jpg',
        'biography'       => 'bio',
        'media_count'     => 3,
        'follower_count'  => 10,
        'following_count' => 5,
        'is_private'      => false,
        'is_verified'     => false,
    ];

    private array $mediasResponse = [
        'success'        => true,
        'posts'          => [
            ['pk' => '111', 'media_type' => 1],
            ['pk' => '222', 'media_type' => 1],
        ],
        'next_cursor'    => 'cursor-abc',
        'more_available' => true,
    ];

    protected function setUp(): void {
        parent::setUp();
        $this->user    = User::factory()->create();
        $this->account = InstagramAccount::factory()->create([
            'user_id'      => $this->user->id,
            'session_data' => '{"uuids":{},"cookies":{}}',
        ]);
    }

    public function test_profile_returns_data(): void {
        $this->mock(InstagramClientServiceInterface::class)
            ->shouldReceive('getOwnProfile')
            ->andReturn($this->profileResponse);

        $this->actingAs($this->user)
            ->getJson("/api/showcase/{$this->account->id}/profile")
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.username', 'me');
    }

    public function test_medias_merges_default_overlay_into_each_post(): void {
        $this->mock(InstagramClientServiceInterface::class)
            ->shouldReceive('getOwnMedias')
            ->andReturn($this->mediasResponse);

        $this->actingAs($this->user)
            ->getJson("/api/showcase/{$this->account->id}/medias")
            ->assertStatus(200)
            ->assertJsonPath('data.next_cursor', 'cursor-abc')
            ->assertJsonPath('data.more_available', true)
            ->assertJsonPath('data.posts.0.overlay.is_ad', false)
            ->assertJsonPath('data.posts.0.overlay.board_position', null)
            ->assertJsonPath('data.posts.1.overlay.is_hidden_local', false);
    }

    public function test_profile_returns_404_for_nonexistent_account(): void {
        $this->actingAs($this->user)
            ->getJson('/api/showcase/99999/profile')
            ->assertStatus(404)
            ->assertJsonPath('success', false);
    }

    public function test_profile_returns_404_for_other_users_account(): void {
        $other   = User::factory()->create();
        $account = InstagramAccount::factory()->create(['user_id' => $other->id]);

        $this->mock(InstagramClientServiceInterface::class)
            ->shouldNotReceive('getOwnProfile');

        $this->actingAs($this->user)
            ->getJson("/api/showcase/{$account->id}/profile")
            ->assertStatus(404);
    }

    public function test_showcase_requires_auth(): void {
        $this->getJson("/api/showcase/{$this->account->id}/profile")
            ->assertStatus(401);
    }

    public function test_inactive_user_gets_403(): void {
        $inactive = User::factory()->inactive()->create();
        $account  = InstagramAccount::factory()->create(['user_id' => $inactive->id]);

        $this->actingAs($inactive)
            ->getJson("/api/showcase/{$account->id}/profile")
            ->assertStatus(403);
    }
}
