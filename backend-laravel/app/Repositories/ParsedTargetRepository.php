<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\ParsedTarget;
use Illuminate\Database\Eloquent\Collection;

class ParsedTargetRepository implements ParsedTargetRepositoryInterface {
    public function create(array $data): ParsedTarget {
        return ParsedTarget::create($data);
    }

    public function createMany(array $items): bool {
        return ParsedTarget::insert($items);
    }

    public function findByIdAndUser(int $id, int $userId): ParsedTarget | null {
        return ParsedTarget::where('id', $id)
            ->where('user_id', $userId)
            ->first();
    }

    public function getByParseRun(int $parseRunId, ?string $status = null): Collection {
        $query = ParsedTarget::where('parse_run_id', $parseRunId);
        $status !== null && $query->where('status', $status);

        return $query->orderBy('id')->get();
    }

    public function updateStatus(int $id, string $status): bool {
        return ParsedTarget::where('id', $id)->update(['status' => $status]) > 0;
    }
}
