<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\AutomationTask;
use Illuminate\Database\Eloquent\Collection;

class AutomationTaskRepository implements AutomationTaskRepositoryInterface {
    public function create(array $data): AutomationTask {
        return AutomationTask::create($data);
    }

    public function findById(int $id): AutomationTask | null {
        return AutomationTask::find($id);
    }

    public function findByIdAndUser(int $id, int $userId): AutomationTask | null {
        return AutomationTask::where('id', $id)
            ->where('user_id', $userId)
            ->first();
    }

    public function findByIdAndUserWithCollectedTargets(int $id, int $userId): AutomationTask | null {
        return AutomationTask::withCollectedTargetsCount()
            ->withParsePhase()
            ->where('id', $id)
            ->where('user_id', $userId)
            ->first();
    }

    public function getByUser(int $userId): Collection {
        return AutomationTask::where('user_id', $userId)
            ->withCollectedTargetsCount()
            ->withParsePhase()
            ->orderBy('id', 'desc')
            ->get();
    }

    public function updateStatus(int $id, string $status): bool {
        return AutomationTask::where('id', $id)->update(['status' => $status]) > 0;
    }

    public function updateSpreadSeconds(int $id, int $spreadSeconds): bool {
        return AutomationTask::where('id', $id)->update(['spread_seconds' => $spreadSeconds]) > 0;
    }

    public function delete(int $id): bool {
        return AutomationTask::where('id', $id)->delete() > 0;
    }
}
