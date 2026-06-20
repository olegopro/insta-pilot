<?php

declare(strict_types=1);

namespace App\Services\Automation;

use App\Models\InstagramAccount;
use Carbon\Carbon;

interface WorkingHoursServiceInterface {
    public function isOpenNow(InstagramAccount $account): bool;

    public function nextOpenSlot(InstagramAccount $account, Carbon $from): Carbon;
}
