<?php

declare(strict_types=1);

namespace App\Services\Automation;

use App\Models\AccountWorkingHours;
use App\Models\InstagramAccount;
use Carbon\Carbon;

final class WorkingHoursService implements WorkingHoursServiceInterface {
    public function isOpenNow(InstagramAccount $account): bool {
        return $this->isOpenAt($account, Carbon::now());
    }

    public function nextOpenSlot(InstagramAccount $account, Carbon $from): Carbon {
        $workingHours = $this->workingHours($account);

        if ($workingHours === null || !$workingHours->is_enabled) {
            return $from->copy();
        }

        $time = $from->copy()->setTimezone($workingHours->timezone);

        for ($i = 0; $i < 24 * 8; $i++) {
            if ($this->isOpenInSchedule($workingHours->schedule ?? [], $time)) {
                return $time->copy()->setTimezone($from->timezone);
            }

            $time = $time->copy()->addHour()->startOfHour();
        }

        return $from->copy()->addDay();
    }

    private function isOpenAt(InstagramAccount $account, Carbon $at): bool {
        $workingHours = $this->workingHours($account);

        if ($workingHours === null || !$workingHours->is_enabled) {
            return true;
        }

        return $this->isOpenInSchedule(
            $workingHours->schedule ?? [],
            $at->copy()->setTimezone($workingHours->timezone)
        );
    }

    private function workingHours(InstagramAccount $account): AccountWorkingHours | null {
        return AccountWorkingHours::where('instagram_account_id', $account->id)->first();
    }

    /**
     * @param array<int, array<int, bool>> $schedule
     */
    private function isOpenInSchedule(array $schedule, Carbon $time): bool {
        return (bool) ($schedule[$time->dayOfWeek][$time->hour] ?? false);
    }
}
