<?php

declare(strict_types=1);

namespace Tests\Feature\InstagramAccount;

use App\Models\InstagramAccount;
use App\Models\User;
use App\Services\InstagramClientServiceInterface;
use Tests\TestCase;

class InstagramAccountTest extends TestCase {
    private User $user;
    private string $token;

    protected function setUp(): void {
        parent::setUp();
        $this->createRoles();

        $this->user = User::factory()->create();
        $this->user->assignRole('user');
        $this->token = $this->user->createToken('api')->plainTextToken;
    }

    public function test_user_sees_only_own_accounts(): void {
        InstagramAccount::factory()->count(2)->create(['user_id' => $this->user->id]);

        $otherUser = User::factory()->create();
        InstagramAccount::factory()->create(['user_id' => $otherUser->id]);

        $response = $this->withToken($this->token)->getJson('/api/accounts/');

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertCount(2, $response->json('data'));
    }

    public function test_user_cannot_see_another_users_account(): void {
        $otherUser = User::factory()->create();
        $account   = InstagramAccount::factory()->create(['user_id' => $otherUser->id]);

        $response = $this->withToken($this->token)->getJson("/api/accounts/{$account->id}");

        $response->assertStatus(404)
            ->assertJson(['success' => false]);
    }

    public function test_user_cannot_delete_another_users_account(): void {
        $otherUser = User::factory()->create();
        $account   = InstagramAccount::factory()->create(['user_id' => $otherUser->id]);

        $response = $this->withToken($this->token)->deleteJson("/api/accounts/{$account->id}");

        $response->assertStatus(404)
            ->assertJson(['success' => false]);
    }

    public function test_unauthenticated_cannot_list_accounts(): void {
        $response = $this->getJson('/api/accounts/');

        $response->assertStatus(401);
    }

    public function test_account_login_creates_account_with_user_id(): void {
        $this->mock(InstagramClientServiceInterface::class, function ($mock) {
            $mock->shouldReceive('login')
                ->once()
                ->andReturn([
                    'success'         => true,
                    'session_data'    => '{}',
                    'full_name'       => 'Test Account',
                    'profile_pic_url' => null,
                ]);
        });

        $response = $this->withToken($this->token)->postJson('/api/accounts/login', [
            'instagram_login'    => 'testaccount',
            'instagram_password' => 'secret123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => ['instagram_login' => 'testaccount'],
            ]);

        $this->assertDatabaseHas('instagram_accounts', [
            'instagram_login' => 'testaccount',
            'user_id'         => $this->user->id,
        ]);
    }

    public function test_account_login_fails_if_client_returns_error(): void {
        $this->mock(InstagramClientServiceInterface::class, function ($mock) {
            $mock->shouldReceive('login')
                ->once()
                ->andReturn([
                    'success' => false,
                    'error'   => 'Неверный пароль',
                ]);
        });

        $response = $this->withToken($this->token)->postJson('/api/accounts/login', [
            'instagram_login'    => 'failaccount',
            'instagram_password' => 'wrongpass',
        ]);

        $response->assertStatus(422)
            ->assertJson(['success' => false]);
    }

    public function test_account_login_validates_required_fields(): void {
        $response = $this->withToken($this->token)->postJson('/api/accounts/login', []);

        $response->assertStatus(422);
    }

    public function test_user_can_delete_own_account(): void {
        $account = InstagramAccount::factory()->create(['user_id' => $this->user->id]);

        $response = $this->withToken($this->token)->deleteJson("/api/accounts/{$account->id}");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseMissing('instagram_accounts', ['id' => $account->id]);
    }
}
