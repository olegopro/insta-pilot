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

    public static function pruneThresholdProvider(): array {
        return [
            // [возраст лога в днях, опция --days (null = дефолт 30), ожидаемый count после prune]
            'old log deleted at default threshold' => [100, null, 0],
            'fresh log kept at default threshold'  => [10, null, 1],
            'days option lowers threshold'         => [5, 3, 0]
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('pruneThresholdProvider')]
    public function test_prune_threshold(int $ageDays, ?int $daysOption, int $expectedCount): void {
        $this->makeLog(now()->subDays($ageDays)->toDateTimeString());

        $args = $daysOption === null ? [] : ['--days' => $daysOption];
        $this->artisan('activity:prune', $args)->assertSuccessful();

        $this->assertEquals($expectedCount, AccountActivityLog::count());
    }

    public function test_prune_output_contains_count(): void {
        $this->makeLog(now()->subDays(100)->toDateTimeString());
        $this->makeLog(now()->subDays(200)->toDateTimeString());

        $this->artisan('activity:prune')
            ->expectsOutputToContain('2')
            ->assertSuccessful();
    }
}
