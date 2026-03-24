<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\AccountActivityLog;
use App\Models\InstagramAccount;
use App\Models\User;
use App\Repositories\ActivityLogRepository;
use Tests\TestCase;

class ActivityLogRepositoryTest extends TestCase {
    private ActivityLogRepository $repository;
    private InstagramAccount $account;

    protected function setUp(): void {
        parent::setUp();
        $this->repository = new ActivityLogRepository();
        $this->account = InstagramAccount::factory()->create();
    }

    private function makeLog(array $overrides = []): AccountActivityLog {
        return AccountActivityLog::factory()->create([
            'instagram_account_id' => $this->account->id,
            ...$overrides,
        ]);
    }

    // ─── getByAccount — базовая пагинация ──────────────────────────────────────

    public function test_get_by_account_returns_paginated_items(): void {
        AccountActivityLog::factory()->count(5)->create(['instagram_account_id' => $this->account->id]);

        $result = $this->repository->getByAccount($this->account->id, perPage: 3);

        $this->assertCount(3, $result['items']);
        $this->assertTrue($result['has_more_before']);
        $this->assertEquals(5, $result['total']);
    }

    public function test_get_by_account_filters_by_action(): void {
        $this->makeLog(['action' => 'like']);
        $this->makeLog(['action' => 'like']);
        $this->makeLog(['action' => 'comment']);

        $result = $this->repository->getByAccount($this->account->id, action: 'like');

        $this->assertCount(2, $result['items']);
        foreach ($result['items'] as $item) {
            $this->assertEquals('like', $item['action']);
        }
    }

    public function test_get_by_account_filters_by_status(): void {
        $this->makeLog(['status' => 'success']);
        $this->makeLog(['status' => 'success']);
        $this->makeLog(['status' => 'fail']);

        $result = $this->repository->getByAccount($this->account->id, status: 'success');

        $this->assertCount(2, $result['items']);
    }

    public function test_get_by_account_filters_by_http_code(): void {
        $this->makeLog(['http_code' => 200]);
        $this->makeLog(['http_code' => 200]);
        $this->makeLog(['http_code' => 429]);

        $result = $this->repository->getByAccount($this->account->id, httpCode: 200);

        $this->assertCount(2, $result['items']);
    }

    public function test_get_by_account_filters_by_date_range(): void {
        $this->makeLog(['created_at' => now()->subDays(3)]);
        $this->makeLog(['created_at' => now()->subDays(1)]);
        $this->makeLog(['created_at' => now()]);

        $result = $this->repository->getByAccount(
            $this->account->id,
            dateFrom: now()->subDays(2)->toDateString(),
            dateTo: now()->toDateString(),
        );

        $this->assertCount(2, $result['items']);
    }

    public function test_get_by_account_before_id_loads_older(): void {
        $logs = collect();
        for ($i = 0; $i < 5; $i++) {
            $logs->push($this->makeLog());
        }
        $middleId = $logs->get(2)->id;

        $result = $this->repository->getByAccount($this->account->id, beforeId: $middleId);

        foreach ($result['items'] as $item) {
            $this->assertLessThan($middleId, $item['id']);
        }
    }

    public function test_get_by_account_after_id_loads_newer(): void {
        $logs = collect();
        for ($i = 0; $i < 5; $i++) {
            $logs->push($this->makeLog());
        }
        $middleId = $logs->get(1)->id;

        $result = $this->repository->getByAccount($this->account->id, afterId: $middleId);

        foreach ($result['items'] as $item) {
            $this->assertGreaterThan($middleId, $item['id']);
        }
    }

    public function test_get_by_account_combined_filters(): void {
        $this->makeLog(['action' => 'like', 'status' => 'success']);
        $this->makeLog(['action' => 'like', 'status' => 'fail']);
        $this->makeLog(['action' => 'comment', 'status' => 'success']);

        $result = $this->repository->getByAccount(
            $this->account->id,
            action: 'like',
            status: 'success',
        );

        $this->assertCount(1, $result['items']);
    }

    // ─── getAroundId ───────────────────────────────────────────────────────────

    public function test_get_around_id_centers_on_target(): void {
        $logs = collect();
        for ($i = 0; $i < 10; $i++) {
            $logs->push($this->makeLog());
        }
        $targetLog = $logs->get(4);

        $result = $this->repository->getByAccount($this->account->id, aroundId: $targetLog->id);

        $this->assertEquals($targetLog->id, $result['focused_id']);
        $ids = array_column($result['items'], 'id');
        $this->assertContains($targetLog->id, $ids);
    }

    public function test_get_around_id_returns_null_for_nonexistent(): void {
        $result = $this->repository->getByAccount($this->account->id, aroundId: 99999);

        $this->assertEquals(99999, $result['focused_id']);
        $this->assertEmpty($result['items']);
    }

    // ─── getStatsByAccount ─────────────────────────────────────────────────────

    public function test_get_stats_by_account_counts_correctly(): void {
        $this->makeLog(['status' => 'success', 'action' => 'like', 'duration_ms' => 200]);
        $this->makeLog(['status' => 'success', 'action' => 'like', 'duration_ms' => 400]);
        $this->makeLog(['status' => 'fail',    'action' => 'like', 'duration_ms' => 300]);

        $stats = $this->repository->getStatsByAccount($this->account->id);

        $this->assertEquals(3, $stats['total']);
        $this->assertEqualsWithDelta(66.7, $stats['success_rate'], 0.2);
        $this->assertEquals(300, $stats['avg_duration_ms']);
        $this->assertArrayHasKey('like', $stats['by_action']);
        $this->assertEquals(3, $stats['by_action']['like']['total']);
        $this->assertEquals(2, $stats['by_action']['like']['success']);
        $this->assertEquals(1, $stats['by_action']['like']['error']);
    }

    public function test_get_stats_last_error_is_null_when_all_success(): void {
        $this->makeLog(['status' => 'success']);

        $stats = $this->repository->getStatsByAccount($this->account->id);

        $this->assertNull($stats['last_error']);
    }

    public function test_get_stats_last_error_populated_on_fail(): void {
        $this->makeLog([
            'status'        => 'fail',
            'error_message' => 'Rate limited',
            'error_code'    => 'rate_limited',
        ]);

        $stats = $this->repository->getStatsByAccount($this->account->id);

        $this->assertNotNull($stats['last_error']);
        $this->assertEquals('Rate limited', $stats['last_error']['error_message']);
        $this->assertEquals('rate_limited', $stats['last_error']['error_code']);
    }
}
