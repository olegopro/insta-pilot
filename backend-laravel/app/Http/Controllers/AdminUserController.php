<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Repositories\UserRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AdminUserController extends Controller {
    public function __construct(
        private readonly UserRepositoryInterface $userRepository
    ) {}

    public function index(): JsonResponse {
        $users = $this->userRepository->all();

        return response()->json([
            'success' => true,
            'data'    => $users,
            'message' => 'OK',
        ]);
    }

    public function toggleActive(int $id): JsonResponse {
        $user = $this->userRepository->findById($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'error'   => 'Пользователь не найден',
            ], 404);
        }

        $updated = $this->userRepository->toggleActive($user);

        return response()->json([
            'success' => true,
            'data'    => $updated,
            'message' => $updated->is_active ? 'Пользователь активирован' : 'Пользователь деактивирован',
        ]);
    }

    public function updateRole(int $id, Request $request): JsonResponse {
        $validated = $request->validate([
            'role' => 'required|string|in:admin,user',
        ]);

        $user = $this->userRepository->findById($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'error'   => 'Пользователь не найден',
            ], 404);
        }

        $updated = $this->userRepository->updateRole($user, $validated['role']);

        return response()->json([
            'success' => true,
            'data'    => $updated,
            'message' => 'Роль обновлена',
        ]);
    }
}
