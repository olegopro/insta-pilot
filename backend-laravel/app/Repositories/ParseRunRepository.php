<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\ParseRun;
use Illuminate\Database\Eloquent\Collection;

class ParseRunRepository implements ParseRunRepositoryInterface {
    public function create(array $data): ParseRun {
        return ParseRun::create($data);
    }

    public function findById(int $id): ParseRun | null {
        return ParseRun::find($id);
    }

    public function findByIdAndUser(int $id, int $userId): ParseRun | null {
        return ParseRun::where('id', $id)
            ->where('user_id', $userId)
            ->first();
    }

    public function getByUser(int $userId): Collection {
        return ParseRun::where('user_id', $userId)
            ->orderBy('id', 'desc')
            ->get();
    }

    public function updateStatus(int $id, string $status, ?string $errorMessage = null): bool {
        $data = ['status' => $status];
        $errorMessage !== null && $data['error_message'] = $errorMessage;

        return ParseRun::where('id', $id)->update($data) > 0;
    }
}
