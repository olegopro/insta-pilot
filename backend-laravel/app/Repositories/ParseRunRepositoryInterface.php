<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\ParseRun;
use Illuminate\Database\Eloquent\Collection;

interface ParseRunRepositoryInterface {
    public function create(array $data): ParseRun;
    public function findById(int $id): ParseRun | null;
    public function findByIdAndUser(int $id, int $userId): ParseRun | null;
    public function getByUser(int $userId): Collection;
    public function updateStatus(int $id, string $status, ?string $errorMessage = null): bool;
    public function reset(int $id): bool;
}
