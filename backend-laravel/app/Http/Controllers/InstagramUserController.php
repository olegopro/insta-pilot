<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Repositories\InstagramAccountRepositoryInterface;
use App\Services\InstagramClientServiceInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class InstagramUserController extends Controller {
    public function __construct(
        private readonly InstagramClientServiceInterface $instagramClient,
        private readonly InstagramAccountRepositoryInterface $accountRepository
    ) {}

    public function show(int $accountId, string $userPk, Request $request): JsonResponse {
        $account = $this->accountRepository->findByIdAndUser($accountId, $request->user()->id);

        if (!$account) {
            return response()->json([
                'success' => false,
                'error'   => 'Аккаунт не найден'
            ], 404);
        }

        if (!$account->session_data) {
            return response()->json([
                'success' => false,
                'error'   => 'Сессия не найдена'
            ], 422);
        }

        $result = $this->instagramClient->getUserInfoByPk($account->session_data, $userPk, $account->id);

        if (empty($result['success'])) {
            return response()->json([
                'success' => false,
                'error'   => $result['error'] ?? 'Ошибка получения профиля'
            ], 422);
        }

        return response()->json([
            'success' => true,
            'data'    => $result['user'] ?? null,
            'message' => 'OK'
        ]);
    }
}
