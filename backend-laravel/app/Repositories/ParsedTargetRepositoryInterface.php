<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\ParsedTarget;
use Illuminate\Database\Eloquent\Collection;

interface ParsedTargetRepositoryInterface {
    public function create(array $data): ParsedTarget;
    public function createMany(array $items): bool;
    public function findByIdAndUser(int $id, int $userId): ParsedTarget | null;
    public function getByParseRun(int $parseRunId, ?string $status = null): Collection;
    public function updateStatus(int $id, string $status): bool;
}
