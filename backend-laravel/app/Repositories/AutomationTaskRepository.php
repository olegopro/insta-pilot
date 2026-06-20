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

    public function getByUser(int $userId): Collection {
        return AutomationTask::where('user_id', $userId)
            ->orderBy('id', 'desc')
            ->get();
    }

    public function updateStatus(int $id, string $status): bool {
        return AutomationTask::where('id', $id)->update(['status' => $status]) > 0;
    }
}
