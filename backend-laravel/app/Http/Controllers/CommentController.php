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

    public function index(Request $request): JsonResponse {
        $validated = $request->validate([
            'account_id' => 'required|integer',
            'media_pk'   => 'required|string',
            'min_id'     => 'nullable|string'
        ]);

        $account = $this->accountRepository->findByIdAndUser((int) $validated['account_id'], $request->user()->id);

        if (!$account) {
            return response()->json(['success' => false, 'error' => 'Аккаунт не найден'], 404);
        }

        if (!$account->session_data) {
            return response()->json(['success' => false, 'error' => 'Сессия не найдена'], 422);
        }

        $result = $this->instagramClient->fetchMediaComments(
            $account->session_data,
            $account->id,
            $validated['media_pk'],
            $validated['min_id'] ?? null,
        );

        if (empty($result['success'])) {
            return response()->json(['success' => false, 'error' => $result['error'] ?? 'Ошибка загрузки комментариев'], 422);
        }

        return response()->json(['success' => true, 'data' => $result]);
    }

    public function replies(Request $request): JsonResponse {
        $validated = $request->validate([
            'account_id'  => 'required|integer',
            'media_pk'    => 'required|string',
            'comment_pk'  => 'required|string',
            'min_id'      => 'nullable|string'
        ]);

        $account = $this->accountRepository->findByIdAndUser((int) $validated['account_id'], $request->user()->id);

        if (!$account) {
            return response()->json(['success' => false, 'error' => 'Аккаунт не найден'], 404);
        }

        if (!$account->session_data) {
            return response()->json(['success' => false, 'error' => 'Сессия не найдена'], 422);
        }

        $result = $this->instagramClient->fetchCommentReplies(
            $account->session_data,
            $account->id,
            $validated['media_pk'],
            $validated['comment_pk'],
            $validated['min_id'] ?? null,
        );

        if (empty($result['success'])) {
            return response()->json(['success' => false, 'error' => $result['error'] ?? 'Ошибка загрузки ответов'], 422);
        }

        return response()->json(['success' => true, 'data' => $result]);
    }

    public function store(string $mediaId, Request $request): JsonResponse {
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
            $account->id,
            $mediaId,
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
