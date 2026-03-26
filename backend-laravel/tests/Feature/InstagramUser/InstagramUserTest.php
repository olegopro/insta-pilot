<?php

declare(strict_types=1);

namespace Tests\Feature\InstagramUser;

use App\Models\InstagramAccount;
use App\Models\User;
use App\Services\InstagramClientServiceInterface;
use Tests\TestCase;

class InstagramUserTest extends TestCase {
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

    public function test_show_returns_user_data(): void {
        $this->mock(InstagramClientServiceInterface::class)
            ->shouldReceive('getUserInfoByPk')
            ->andReturn([
                'success' => true,
                'user'    => [
                    'pk'              => '12345678',
                    'username'        => 'testuser',
                    'full_name'       => 'Test User',
                    'follower_count'  => 500,
                    'following_count' => 300,
                ],
            ]);

        $this->actingAs($this->user)
            ->getJson("/api/instagram-user/{$this->account->id}/12345678")
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.username', 'testuser');
    }

    public function test_returns_404_for_other_users_account(): void {
        $other   = User::factory()->create();
        $account = InstagramAccount::factory()->create(['user_id' => $other->id]);

        $this->actingAs($this->user)
            ->getJson("/api/instagram-user/{$account->id}/12345678")
            ->assertStatus(404)
            ->assertJsonPath('success', false);
    }

    public function test_returns_422_when_no_session_data(): void {
        $account = InstagramAccount::factory()->create([
            'user_id'      => $this->user->id,
            'session_data' => null,
        ]);

        $this->actingAs($this->user)
            ->getJson("/api/instagram-user/{$account->id}/12345678")
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_returns_422_on_instagram_error(): void {
        $this->mock(InstagramClientServiceInterface::class)
            ->shouldReceive('getUserInfoByPk')
            ->andReturn([
                'success' => false,
                'error'   => 'User not found',
            ]);

        $this->actingAs($this->user)
            ->getJson("/api/instagram-user/{$this->account->id}/99999999")
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_requires_auth(): void {
        $this->getJson("/api/instagram-user/{$this->account->id}/12345678")
            ->assertStatus(401);
    }

    public function test_inactive_user_gets_403(): void {
        $inactive = User::factory()->inactive()->create();
        $account  = InstagramAccount::factory()->create([
            'user_id'      => $inactive->id,
            'session_data' => $this->sessionData,
        ]);

        $this->actingAs($inactive)
            ->getJson("/api/instagram-user/{$account->id}/12345678")
            ->assertStatus(403);
    }
}
