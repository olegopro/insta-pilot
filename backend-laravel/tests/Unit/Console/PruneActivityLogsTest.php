<?php

declare(strict_types=1);

namespace Tests\Unit\Console;

use App\Models\AccountActivityLog;
use App\Models\InstagramAccount;
use App\Models\User;
use Tests\TestCase;

class PruneActivityLogsTest extends TestCase {
    private function makeLog(string $createdAt): AccountActivityLog {
        $account = InstagramAccount::factory()->create();
        $user    = User::factory()->create();

        return AccountActivityLog::factory()->create([
            'instagram_account_id' => $account->id,
            'user_id'              => $user->id,
            'created_at'           => $createdAt,
        ]);
    }

    public function test_prune_deletes_old_logs(): void {
        $this->makeLog(now()->subDays(100)->toDateTimeString());

        $this->artisan('activity:prune')->assertSuccessful();

        $this->assertEquals(0, AccountActivityLog::count());
    }

    public function test_prune_keeps_fresh_logs(): void {
        $this->makeLog(now()->subDays(10)->toDateTimeString());

        $this->artisan('activity:prune')->assertSuccessful();

        $this->assertEquals(1, AccountActivityLog::count());
    }

    public function test_prune_days_option_changes_threshold(): void {
        $this->makeLog(now()->subDays(5)->toDateTimeString());

        $this->artisan('activity:prune', ['--days' => 3])->assertSuccessful();

        $this->assertEquals(0, AccountActivityLog::count());
    }

    public function test_prune_output_contains_count(): void {
        $this->makeLog(now()->subDays(100)->toDateTimeString());
        $this->makeLog(now()->subDays(200)->toDateTimeString());

        $this->artisan('activity:prune')
            ->expectsOutputToContain('2')
            ->assertSuccessful();
    }
}
