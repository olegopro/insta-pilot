<?php

declare(strict_types=1);

namespace Tests\Feature\ActivityLog;

use App\Models\AccountActivityLog;
use App\Models\InstagramAccount;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class ActivityLogTest extends TestCase {
    private User $user;
    private InstagramAccount $account;

    protected function setUp(): void {
        parent::setUp();
        Event::fake(); // предотвращаем реальный broadcast при создании логов

        $this->user    = User::factory()->create();
        $this->account = InstagramAccount::factory()->create(['user_id' => $this->user->id]);
    }

    private function makeLog(array $override = []): AccountActivityLog {
        return AccountActivityLog::factory()->create(array_merge([
            'instagram_account_id' => $this->account->id,
            'user_id'              => $this->user->id,
        ], $override));
    }

    // --- index ---

    public function test_index_returns_logs(): void {
        $this->makeLog(['action' => 'like', 'status' => 'success']);
        $this->makeLog(['action' => 'comment', 'status' => 'success']);

        $response = $this->actingAs($this->user)
            ->getJson("/api/accounts/{$this->account->id}/activity");

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.total', 2);
    }

    public function test_index_filters_by_action(): void {
        $this->makeLog(['action' => 'like']);
        $this->makeLog(['action' => 'comment']);

        $this->actingAs($this->user)
            ->getJson("/api/accounts/{$this->account->id}/activity?action=like")
            ->assertStatus(200)
            ->assertJsonCount(1, 'data.items');
    }

    public function test_index_filters_by_status(): void {
        $this->makeLog(['status' => 'success']);
        $this->makeLog(['status' => 'fail']);

        $this->actingAs($this->user)
            ->getJson("/api/accounts/{$this->account->id}/activity?status=fail")
            ->assertStatus(200)
            ->assertJsonCount(1, 'data.items');
    }

    public function test_index_filters_by_date(): void {
        $this->makeLog(['created_at' => now()->subDays(10)]);
        $this->makeLog(['created_at' => now()->subDays(1)]);

        $dateFrom = now()->subDays(3)->format('Y-m-d');

        $this->actingAs($this->user)
            ->getJson("/api/accounts/{$this->account->id}/activity?date_from={$dateFrom}")
            ->assertStatus(200)
            ->assertJsonCount(1, 'data.items');
    }

    public function test_index_returns_empty_array_when_no_logs(): void {
        $this->actingAs($this->user)
            ->getJson("/api/accounts/{$this->account->id}/activity")
            ->assertStatus(200)
            ->assertJsonPath('data.items', [])
            ->assertJsonPath('data.total', 0);
    }

    // --- stats ---

    public function test_stats_returns_counts(): void {
        $this->makeLog(['action' => 'like', 'status' => 'success']);
        $this->makeLog(['action' => 'like', 'status' => 'fail']);

        $response = $this->actingAs($this->user)
            ->getJson("/api/accounts/{$this->account->id}/activity/stats");

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total', 2);
    }

    // --- summary ---

    public function test_summary_returns_grouped_data(): void {
        $this->makeLog(['action' => 'like',    'status' => 'success']);
        $this->makeLog(['action' => 'comment', 'status' => 'success']);

        $response = $this->actingAs($this->user)
            ->getJson('/api/activity/summary');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    // --- ownership / auth ---

    public function test_other_user_gets_403(): void {
        $other = User::factory()->create();

        $this->actingAs($other)
            ->getJson("/api/accounts/{$this->account->id}/activity")
            ->assertStatus(403);
    }

    public function test_admin_can_view_any_account_logs(): void {
        $this->createRoles();
        /** @var User $admin */
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->makeLog();

        $this->actingAs($admin)
            ->getJson("/api/accounts/{$this->account->id}/activity")
            ->assertStatus(200)
            ->assertJsonCount(1, 'data.items');
    }

    public function test_requires_auth(): void {
        $this->getJson("/api/accounts/{$this->account->id}/activity")
            ->assertStatus(401);
    }

    public function test_inactive_user_gets_403(): void {
        $inactive = User::factory()->inactive()->create();
        $account  = InstagramAccount::factory()->create(['user_id' => $inactive->id]);

        $this->actingAs($inactive)
            ->getJson("/api/accounts/{$account->id}/activity")
            ->assertStatus(403);
    }
}
