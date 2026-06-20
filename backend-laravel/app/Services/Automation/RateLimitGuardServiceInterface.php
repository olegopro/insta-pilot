<?php

declare(strict_types=1);

namespace App\Services\Automation;

use App\Models\AutomationActionItem;
use App\Models\InstagramAccount;

interface RateLimitGuardServiceInterface {
    public function reserve(InstagramAccount $account, string $limitKey, AutomationActionItem $item): bool;

    public function release(InstagramAccount $account, string $limitKey, AutomationActionItem $item): void;
}
