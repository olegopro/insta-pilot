<?php

declare(strict_types=1);

namespace Tests\Unit\Middleware;

use App\Models\User;
use Tests\TestCase;

class EnsureUserIsActiveTest extends TestCase {
    public function test_active_user_passes_through(): void {
        $user = User::factory()->create(['is_active' => true]);

        $response = $this->actingAs($user)->getJson('/api/auth/me');

        $response->assertStatus(200);
    }

    public function test_inactive_user_gets_403(): void {
        $user = User::factory()->inactive()->create();

        $response = $this->actingAs($user)->getJson('/api/auth/me');

        $response->assertStatus(403);
        $response->assertJson(['success' => false]);
    }

    public function test_inactive_user_response_contains_error_key(): void {
        $user = User::factory()->inactive()->create();

        $response = $this->actingAs($user)->getJson('/api/auth/me');

        $response->assertJsonStructure(['success', 'error']);
    }

    public function test_unauthenticated_request_is_not_blocked_by_middleware(): void {
        // Middleware пропускает неаутентифицированных (проверяет только if user && !is_active)
        // Sanctum вернёт 401 раньше, но middleware само не возвращает 403
        $response = $this->getJson('/api/auth/me');

        $response->assertStatus(401);
    }
}
