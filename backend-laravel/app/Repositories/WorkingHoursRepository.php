<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\AccountWorkingHours;
use Carbon\CarbonImmutable;
use DateTimeInterface;

class WorkingHoursRepository implements WorkingHoursRepositoryInterface {
    public function getForAccount(int $instagramAccountId): AccountWorkingHours | null {
        return AccountWorkingHours::where('instagram_account_id', $instagramAccountId)->first();
    }

    public function isWithinWindow(int $instagramAccountId, ?DateTimeInterface $at = null): bool {
        $workingHours = $this->getForAccount($instagramAccountId);

        if ($workingHours === null || !$workingHours->is_enabled) {
            return true;
        }

        $time = CarbonImmutable::instance($at ?? now())->setTimezone($workingHours->timezone);
        $dayIndex = $time->dayOfWeek;
        $hourIndex = $time->hour;

        return (bool) ($workingHours->schedule[$dayIndex][$hourIndex] ?? false);
    }
}
