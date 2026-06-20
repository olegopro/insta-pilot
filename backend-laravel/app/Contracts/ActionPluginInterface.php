<?php

declare(strict_types=1);

namespace App\Contracts;

use App\Models\AutomationActionItem;
use App\Models\InstagramAccount;

interface ActionPluginInterface {
    public function key(): string;

    public function limitKey(): string;

    public function estimatedCost(): int;

    public function resolve(AutomationActionItem $item): array;

    public function execute(InstagramAccount $account, array $resolved, int $userId): array;

    public function reconcile(AutomationActionItem $item): string;
}
