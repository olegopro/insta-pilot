<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\AutomationActionItem;
use Illuminate\Database\Eloquent\Collection;

interface AutomationActionItemRepositoryInterface {
    public function create(array $data): AutomationActionItem;
    public function createMany(array $items): bool;
    public function getDueItems(int $limit = 50): Collection;
    public function markRunning(int $id, string $claimToken, int $claimTtlSeconds = 300): bool;
    public function markDone(int $id, ?array $result = null, ?int $activityLogId = null): bool;
    public function markFailed(int $id, ?string $errorCode = null, ?string $errorMessage = null): bool;
}
