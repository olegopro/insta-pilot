<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\User;
use Tests\TestCase;

class AdminUserTest extends TestCase {
    private User $admin;
    private string $adminToken;

    protected function setUp(): void {
        parent::setUp();
        $this->createRoles();

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        $this->adminToken = $this->admin->createToken('api')->plainTextToken;
    }

    public function test_admin_can_list_all_users(): void {
        User::factory()->count(3)->create()->each(fn (User $u) => $u->assignRole('user'));

        $response = $this->withToken($this->adminToken)->getJson('/api/admin/users');

        $response->assertStatus(200)
            ->assertJson(['success' => true])
            ->assertJsonStructure(['data']);

        $this->assertCount(4, $response->json('data')); // 3 + admin
    }

    public function test_non_admin_cannot_list_users(): void {
        $user = User::factory()->create();
        $user->assignRole('user');
        $token = $user->createToken('api')->plainTextToken;

        $response = $this->withToken($token)->getJson('/api/admin/users');

        $response->assertStatus(403);
    }

    public function test_unauthenticated_cannot_access_admin(): void {
        $response = $this->getJson('/api/admin/users');

        $response->assertStatus(401);
    }

    public function test_admin_can_deactivate_user(): void {
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('user');

        $response = $this->withToken($this->adminToken)
            ->patchJson("/api/admin/users/{$user->id}/toggle-active");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => ['is_active' => false],
            ]);
    }

    public function test_admin_can_activate_user(): void {
        $user = User::factory()->inactive()->create();
        $user->assignRole('user');

        $response = $this->withToken($this->adminToken)
            ->patchJson("/api/admin/users/{$user->id}/toggle-active");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => ['is_active' => true],
            ]);
    }

    public function test_admin_can_change_user_role_to_admin(): void {
        $user = User::factory()->create();
        $user->assignRole('user');

        $response = $this->withToken($this->adminToken)
            ->patchJson("/api/admin/users/{$user->id}/role", ['role' => 'admin']);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertTrue($user->fresh()->hasRole('admin'));
    }

    public function test_admin_can_change_user_role_to_user(): void {
        $user = User::factory()->create();
        $user->assignRole('admin');

        $response = $this->withToken($this->adminToken)
            ->patchJson("/api/admin/users/{$user->id}/role", ['role' => 'user']);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertTrue($user->fresh()->hasRole('user'));
    }

    public function test_toggle_active_returns_404_for_unknown_user(): void {
        $response = $this->withToken($this->adminToken)
            ->patchJson('/api/admin/users/99999/toggle-active');

        $response->assertStatus(404)
            ->assertJson(['success' => false]);
    }

    public function test_update_role_validates_role_value(): void {
        $user = User::factory()->create();
        $user->assignRole('user');

        $response = $this->withToken($this->adminToken)
            ->patchJson("/api/admin/users/{$user->id}/role", ['role' => 'superuser']);

        $response->assertStatus(422);
    }
}
