<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

interface UserRepositoryInterface
{
    public function all(): Collection;

    public function findById(int $id): ?User;

    public function toggleActive(User $user): User;

    public function updateRole(User $user, string $role): User;
}
