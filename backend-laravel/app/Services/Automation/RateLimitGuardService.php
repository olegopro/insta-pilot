<?php

declare(strict_types=1);

namespace App\Services\Automation;

use App\Models\AccountActionCounter;
use App\Models\AccountActionLimit;
use App\Models\AccountWorkingHours;
use App\Models\AutomationActionItem;
use App\Models\InstagramAccount;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class RateLimitGuardService implements RateLimitGuardServiceInterface {
    public function reserve(InstagramAccount $account, string $limitKey, AutomationActionItem $item): bool {
        if ($item->quota_reserved_at !== null) {
            return true;
        }

        return DB::transaction(function () use ($account, $limitKey, $item): bool {
            $lockedItem = AutomationActionItem::whereKey($item->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedItem->quota_reserved_at !== null) {
                $item->forceFill(['quota_reserved_at' => $lockedItem->quota_reserved_at]);

                return true;
            }

            $limit = AccountActionLimit::where('instagram_account_id', $account->id)
                ->where('action', $limitKey)
                ->where('is_active', true)
                ->lockForUpdate()
                ->first();

            if ($limit === null || $limit->daily_limit <= 0) {
                return false;
            }

            $localDate = $this->localDate($account);

            AccountActionCounter::insertOrIgnore([
                'instagram_account_id' => $account->id,
                'action' => $limitKey,
                'local_date' => $localDate,
                'used' => 0,
                'created_at' => now(),
                'updated_at' => now()
            ]);

            $counter = AccountActionCounter::where('instagram_account_id', $account->id)
                ->where('action', $limitKey)
                ->where('local_date', $localDate)
                ->lockForUpdate()
                ->firstOrFail();

            if ($counter->used >= $limit->daily_limit) {
                return false;
            }

            $counter->forceFill([
                'used' => $counter->used + 1,
                'updated_at' => now()
            ])->save();

            $reservedAt = now();

            $lockedItem->forceFill(['quota_reserved_at' => $reservedAt])->save();
            $item->forceFill(['quota_reserved_at' => $reservedAt]);

            return true;
        });
    }

    public function release(InstagramAccount $account, string $limitKey, AutomationActionItem $item): void {
        if ($item->quota_reserved_at === null) {
            return;
        }

        DB::transaction(function () use ($account, $limitKey, $item): void {
            $lockedItem = AutomationActionItem::whereKey($item->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedItem->quota_reserved_at === null) {
                return;
            }

            $localDate = $this->localDate($account, CarbonImmutable::instance($lockedItem->quota_reserved_at));

            $counter = AccountActionCounter::where('instagram_account_id', $account->id)
                ->where('action', $limitKey)
                ->where('local_date', $localDate)
                ->lockForUpdate()
                ->first();

            if ($counter !== null && $counter->used > 0) {
                $counter->forceFill([
                    'used' => $counter->used - 1,
                    'updated_at' => now()
                ])->save();
            }

            $lockedItem->forceFill(['quota_reserved_at' => null])->save();
            $item->forceFill(['quota_reserved_at' => null]);
        });
    }

    private function localDate(InstagramAccount $account, ?CarbonImmutable $at = null): string {
        $timezone = AccountWorkingHours::where('instagram_account_id', $account->id)->value('timezone') ?? 'UTC';

        return ($at ?? CarbonImmutable::now())->setTimezone((string) $timezone)->toDateString();
    }
}
