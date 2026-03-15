<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Repositories\InstagramAccountRepositoryInterface;
use App\Services\InstagramClientServiceInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class CommentController extends Controller {
    public function __construct(
        private readonly InstagramClientServiceInterface $instagramClient,
        private readonly InstagramAccountRepositoryInterface $accountRepository
    ) {}

    public function store(string $mediaPk, Request $request): JsonResponse {
        $validated = $request->validate([
            'account_id' => 'required|integer',
            'text'       => 'required|string|max:2200'
        ]);

        $account = $this->accountRepository->findByIdAndUser($validated['account_id'], $request->user()->id);

        if (!$account) {
            return response()->json(['success' => false, 'error' => 'Аккаунт не найден'], 404);
        }

        if (!$account->session_data) {
            return response()->json(['success' => false, 'error' => 'Сессия не найдена'], 422);
        }

        $result = $this->instagramClient->commentMedia(
            $account->session_data,
            $mediaPk,
            $validated['text']
        );

        if (empty($result['success'])) {
            return response()->json(['success' => false, 'error' => $result['error'] ?? 'Ошибка отправки комментария'], 422);
        }

        return response()->json([
            'success' => true,
            'data'    => ['comment_pk' => $result['comment_pk'] ?? null],
            'message' => 'Комментарий отправлен'
        ]);
    }
}
