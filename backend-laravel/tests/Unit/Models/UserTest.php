<?php

declare(strict_types=1);

namespace Tests\Unit\Models;

use App\Models\InstagramAccount;
use App\Models\User;
use Tests\TestCase;

class UserTest extends TestCase {
    public function test_has_roles_trait_works(): void {
        $this->createRoles();

        $user = User::factory()->create();
        $user->assignRole('admin');

        $this->assertTrue($user->hasRole('admin'));
        $this->assertFalse($user->hasRole('user'));
    }

    public function test_inactive_factory_state(): void {
        $user = User::factory()->inactive()->create();

        $this->assertFalse($user->is_active);
    }

    public function test_fillable_contains_required_fields(): void {
        $user    = new User();
        $fillable = $user->getFillable();

        $fields = [
            'name',
            'email',
            'password',
            'is_active'
        ];
        foreach ($fields as $field) {
            $this->assertContains($field, $fillable);
        }
    }

    public function test_has_many_instagram_accounts(): void {
        $user = User::factory()->create();
        InstagramAccount::factory()->count(2)->create(['user_id' => $user->id]);

        $this->assertCount(2, $user->instagramAccounts);
    }

    public function test_password_and_token_hidden_in_json(): void {
        $user = User::factory()->create();

        $json = json_decode($user->toJson(), true);

        $this->assertArrayNotHasKey('password', $json);
        $this->assertArrayNotHasKey('remember_token', $json);
    }
}
