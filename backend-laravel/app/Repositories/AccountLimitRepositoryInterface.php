<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\AccountActionLimit;

interface AccountLimitRepositoryInterface {
    public function getLimit(int $instagramAccountId, string $action): AccountActionLimit | null;
    public function reserveUsage(int $instagramAccountId, string $action, string $localDate): bool;
    public function currentUsage(int $instagramAccountId, string $action, string $localDate): int;
}
