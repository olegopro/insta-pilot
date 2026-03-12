<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Repositories\InstagramAccountRepositoryInterface;
use App\Services\InstagramClientServiceInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class FeedController extends Controller {
    public function __construct(
        private readonly InstagramClientServiceInterface $instagramClient,
        private readonly InstagramAccountRepositoryInterface $accountRepository
    ) {}

    public function index(int $accountId, Request $request): JsonResponse {
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

        $maxId  = $request->query('max_id') ?: null;
        $result = $this->instagramClient->getFeed($account->session_data, $maxId);

        if (empty($result['success'])) {
            return response()->json([
                'success' => false,
                'error'   => $result['error'] ?? 'Ошибка загрузки ленты'
            ], 422);
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'posts'          => $result['posts'] ?? [],
                'next_max_id'    => $result['next_max_id'] ?? null,
                'more_available' => $result['more_available'] ?? false
            ],
            'message' => 'OK'
        ]);
    }

    public function like(int $accountId, Request $request): JsonResponse {
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

        $validated = $request->validate(['media_id' => 'required|string']);
        $result    = $this->instagramClient->addLike($account->session_data, $validated['media_id']);

        if (empty($result['success'])) {
            return response()->json([
                'success' => false,
                'error'   => $result['error'] ?? 'Ошибка лайка'
            ], 422);
        }

        return response()->json([
            'success' => true,
            'data'    => null,
            'message' => 'Лайк поставлен'
        ]);
    }
}
