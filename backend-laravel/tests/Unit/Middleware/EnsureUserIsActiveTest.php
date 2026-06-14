<?php

declare(strict_types=1);

namespace Tests\Unit\Middleware;

use App\Models\User;
use Tests\TestCase;

class EnsureUserIsActiveTest extends TestCase {
    public function test_inactive_user_gets_403_with_error_key(): void {
        $user = User::factory()->inactive()->create();

        $response = $this->actingAs($user)->getJson('/api/auth/me');

        $response->assertStatus(403);
        $response->assertJson(['success' => false]);
        $response->assertJsonStructure(['success', 'error']);
    }
}
