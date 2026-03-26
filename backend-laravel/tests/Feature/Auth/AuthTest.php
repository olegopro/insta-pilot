<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AuthTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();
        $this->createRoles();
    }

    public function test_user_can_register(): void {
        $response = $this->postJson('/api/auth/register', [
            'name'                  => 'Test User',
            'email'                 => 'test@example.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'success',
                'data' => ['user', 'token'],
            ])
            ->assertJson(['success' => true]);
    }

    public function test_register_hashes_password_in_database(): void {
        $email = 'hash@example.com';

        $this->postJson('/api/auth/register', [
            'name'                  => 'Hash Test',
            'email'                 => $email,
            'password'              => 'plainpassword123',
            'password_confirmation' => 'plainpassword123',
        ])->assertStatus(201);

        $raw = DB::table('users')->where('email', $email)->value('password');

        $this->assertNotNull($raw);
        $this->assertNotEquals('plainpassword123', $raw);
    }

    public function test_register_validates_required_fields(): void {
        $response = $this->postJson('/api/auth/register', []);

        $response->assertStatus(422);
    }

    public function test_register_fails_if_email_duplicate(): void {
        User::factory()->create(['email' => 'duplicate@example.com']);

        $response = $this->postJson('/api/auth/register', [
            'name'                  => 'Another User',
            'email'                 => 'duplicate@example.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(422);
    }

    public function test_user_can_login(): void {
        $user = User::factory()->create(['email' => 'login@example.com']);
        $user->assignRole('user');

        $response = $this->postJson('/api/auth/login', [
            'email'    => 'login@example.com',
            'password' => 'password',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['data' => ['token']])
            ->assertJson(['success' => true]);

        $this->assertNotEmpty($response->json('data.token'));
    }

    public function test_login_fails_with_wrong_password(): void {
        User::factory()->create(['email' => 'wrong@example.com']);

        $response = $this->postJson('/api/auth/login', [
            'email'    => 'wrong@example.com',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(401)
            ->assertJson(['success' => false]);
    }

    public function test_inactive_user_cannot_access_protected_routes(): void {
        $user = User::factory()->inactive()->create();
        $user->assignRole('user');
        $token = $user->createToken('api')->plainTextToken;

        $response = $this->withToken($token)->getJson('/api/auth/me');

        $response->assertStatus(403)
            ->assertJson(['success' => false]);
    }

    public function test_user_can_logout(): void {
        $user = User::factory()->create();
        $user->assignRole('user');
        $token = $user->createToken('api')->plainTextToken;

        $response = $this->withToken($token)->postJson('/api/auth/logout');

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_me_returns_authenticated_user(): void {
        $user = User::factory()->create(['email' => 'me@example.com']);
        $user->assignRole('user');
        $token = $user->createToken('api')->plainTextToken;

        $response = $this->withToken($token)->getJson('/api/auth/me');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => ['email' => 'me@example.com'],
            ]);
    }

    public function test_login_fails_with_invalid_email_format(): void {
        $response = $this->postJson('/api/auth/login', [
            'email'    => 'not-an-email',
            'password' => 'password123',
        ]);

        $response->assertStatus(422);
    }

    public function test_unauthenticated_cannot_access_me(): void {
        $response = $this->getJson('/api/auth/me');

        $response->assertStatus(401);
    }
}
