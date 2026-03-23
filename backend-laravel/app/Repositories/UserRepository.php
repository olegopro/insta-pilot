<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\UniqueConstraintViolationException;

final class UserRepository implements UserRepositoryInterface {
    public function all(): Collection {
        return User::with('roles')->orderBy('created_at', 'desc')->get();
    }

    public function findById(int $id): ?User {
        return User::find($id);
    }

    public function toggleActive(User $user): User {
        $user->update(['is_active' => ! $user->is_active]);

        return $user->fresh();
    }

    public function updateRole(User $user, string $role): User {
        if ($user->hasRole($role)) {
            return $user->fresh('roles');
        }

        try {
            $user->syncRoles([$role]);
        } catch (UniqueConstraintViolationException) {
            // race condition: параллельный запрос уже назначил эту роль
        }

        return $user->fresh('roles');
    }
}
