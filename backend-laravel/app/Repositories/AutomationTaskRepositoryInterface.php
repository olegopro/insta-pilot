<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\AutomationTask;
use Illuminate\Database\Eloquent\Collection;

interface AutomationTaskRepositoryInterface {
    public function create(array $data): AutomationTask;
    public function findById(int $id): AutomationTask | null;
    public function findByIdAndUser(int $id, int $userId): AutomationTask | null;
    public function findByIdAndUserWithCollectedTargets(int $id, int $userId): AutomationTask | null;
    public function getByUser(int $userId): Collection;
    public function updateStatus(int $id, string $status): bool;
    public function updateSpreadSeconds(int $id, int $spreadSeconds): bool;
}
