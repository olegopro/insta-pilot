<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\AccountActionCounter;
use App\Models\AccountActionLimit;
use Illuminate\Support\Facades\DB;

class AccountLimitRepository implements AccountLimitRepositoryInterface {
    public function getLimit(int $instagramAccountId, string $action): AccountActionLimit | null {
        return AccountActionLimit::where('instagram_account_id', $instagramAccountId)
            ->where('action', $action)
            ->first();
    }

    public function reserveUsage(int $instagramAccountId, string $action, string $localDate): bool {
        return DB::transaction(function () use ($instagramAccountId, $action, $localDate): bool {
            $limit = AccountActionLimit::where('instagram_account_id', $instagramAccountId)
                ->where('action', $action)
                ->where('is_active', true)
                ->lockForUpdate()
                ->first();

            if ($limit === null) {
                return false;
            }

            AccountActionCounter::insertOrIgnore([
                'instagram_account_id' => $instagramAccountId,
                'action'               => $action,
                'local_date'           => $localDate,
                'used'                 => 0,
                'created_at'           => now(),
                'updated_at'           => now()
            ]);

            $counter = AccountActionCounter::where('instagram_account_id', $instagramAccountId)
                ->where('action', $action)
                ->where('local_date', $localDate)
                ->lockForUpdate()
                ->firstOrFail();

            if ($counter->used >= $limit->daily_limit) {
                return false;
            }

            $counter->increment('used');

            return true;
        });
    }

    public function currentUsage(int $instagramAccountId, string $action, string $localDate): int {
        return (int) AccountActionCounter::where('instagram_account_id', $instagramAccountId)
            ->where('action', $action)
            ->where('local_date', $localDate)
            ->value('used');
    }
}
