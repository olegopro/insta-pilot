<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\User;
use App\Repositories\UserRepository;
use Tests\TestCase;

class UserRepositoryTest extends TestCase {
    private UserRepository $repository;

    protected function setUp(): void {
        parent::setUp();
        $this->createRoles();
        $this->repository = new UserRepository();
    }

    public function test_toggle_active_deactivates_active_user(): void {
        $user = User::factory()->create(['is_active' => true]);

        $result = $this->repository->toggleActive($user);

        $this->assertFalse($result->is_active);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'is_active' => false]);
    }

    public function test_toggle_active_activates_inactive_user(): void {
        $user = User::factory()->inactive()->create();

        $result = $this->repository->toggleActive($user);

        $this->assertTrue($result->is_active);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'is_active' => true]);
    }

    public function test_update_role_assigns_new_role(): void {
        $user = User::factory()->create();
        $user->assignRole('user');

        $result = $this->repository->updateRole($user, 'admin');

        $this->assertTrue($result->hasRole('admin'));
        $this->assertFalse($result->hasRole('user'));
    }

    public function test_find_by_id_returns_null_for_unknown_id(): void {
        $result = $this->repository->findById(99999);

        $this->assertNull($result);
    }
}
