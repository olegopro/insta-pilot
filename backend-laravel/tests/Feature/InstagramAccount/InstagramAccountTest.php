<?php

declare(strict_types=1);

namespace Tests\Feature\InstagramAccount;

use App\Models\DeviceProfile;
use App\Models\InstagramAccount;
use App\Models\User;
use App\Services\InstagramClientServiceInterface;
use Illuminate\Support\Facades\DB;
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
        $profile = DeviceProfile::create([
            'code'            => 'pixel-8-pro',
            'title'           => 'Google Pixel 8 Pro',
            'device_settings' => ['model' => 'Pixel 8 Pro'],
            'user_agent'      => 'Instagram Test Agent',
            'is_active'       => true
        ]);

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
            'device_profile_id'  => $profile->id
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => ['instagram_login' => 'testaccount'],
            ]);

        $this->assertDatabaseHas('instagram_accounts', [
            'instagram_login'   => 'testaccount',
            'user_id'           => $this->user->id,
            'device_profile_id' => $profile->id,
            'device_model_name' => 'Google Pixel 8 Pro'
        ]);
    }

    public function test_account_login_fails_if_client_returns_error(): void {
        $profile = DeviceProfile::create([
            'code'            => 'galaxy-s24',
            'title'           => 'Samsung Galaxy S24 Ultra',
            'device_settings' => ['model' => 'SM-S928B'],
            'user_agent'      => 'Instagram Test Agent',
            'is_active'       => true
        ]);

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
            'device_profile_id'  => $profile->id
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

    public function test_inactive_user_gets_403(): void {
        $inactive = User::factory()->inactive()->create();

        $this->actingAs($inactive)
            ->getJson('/api/accounts/')
            ->assertStatus(403);
    }

    public function test_login_encrypts_password_in_database(): void {
        $profile = DeviceProfile::factory()->create();

        $plainPassword = 'my-plain-password-123';

        $this->mock(InstagramClientServiceInterface::class, function ($mock) {
            $mock->shouldReceive('login')->once()->andReturn([
                'success'         => true,
                'session_data'    => '{}',
                'full_name'       => 'Test',
                'profile_pic_url' => null,
            ]);
        });

        $this->withToken($this->token)->postJson('/api/accounts/login', [
            'instagram_login'    => 'encrypttest',
            'instagram_password' => $plainPassword,
            'device_profile_id'  => $profile->id
        ])->assertStatus(200);

        $raw = DB::table('instagram_accounts')
            ->where('instagram_login', 'encrypttest')
            ->value('instagram_password');

        $this->assertNotNull($raw);
        $this->assertNotEquals($plainPassword, $raw);
    }

    public function test_user_can_get_device_profiles(): void {
        DeviceProfile::create([
            'code'            => 'pixel-8',
            'title'           => 'Google Pixel 8',
            'device_settings' => ['model' => 'Pixel 8'],
            'user_agent'      => 'Instagram Test Agent',
            'is_active'       => true
        ]);

        DeviceProfile::create([
            'code'            => 'disabled',
            'title'           => 'Disabled Device',
            'device_settings' => ['model' => 'Disabled'],
            'user_agent'      => 'Instagram Test Agent',
            'is_active'       => false
        ]);

        $response = $this->withToken($this->token)->getJson('/api/accounts/device-profiles');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [['code' => 'pixel-8']]
            ])
            ->assertJsonMissing(['code' => 'disabled']);
    }
}
