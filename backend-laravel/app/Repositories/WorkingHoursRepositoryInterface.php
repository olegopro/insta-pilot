<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\AccountWorkingHours;
use DateTimeInterface;

interface WorkingHoursRepositoryInterface {
    public function getForAccount(int $instagramAccountId): AccountWorkingHours | null;
    public function isWithinWindow(int $instagramAccountId, ?DateTimeInterface $at = null): bool;
}
