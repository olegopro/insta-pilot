<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Repositories\InstagramAccountRepositoryInterface;
use App\Services\InstagramClientServiceInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SearchController extends Controller {
    public function __construct(
        private readonly InstagramClientServiceInterface $instagramClient,
        private readonly InstagramAccountRepositoryInterface $accountRepository
    ) {}

    public function hashtag(Request $request): JsonResponse {
        $validated = $request->validate([
            'account_id'  => 'required|integer',
            'tag'         => 'required|string',
            'amount'      => 'nullable|integer|min:1|max:100',
            'next_max_id' => 'nullable|string'
        ]);

        $account = $this->accountRepository->findByIdAndUser((int) $validated['account_id'], $request->user()->id);

        if (!$account) {
            return response()->json(['success' => false, 'error' => 'Аккаунт не найден'], 404);
        }

        if (!$account->session_data) {
            return response()->json(['success' => false, 'error' => 'Сессия не найдена'], 422);
        }

        $result = $this->instagramClient->searchHashtag(
            $account->session_data,
            $validated['tag'],
            (int) ($validated['amount'] ?? 30),
            $validated['next_max_id'] ?? null
        );

        if (empty($result['success'])) {
            return response()->json(['success' => false, 'error' => $result['error'] ?? 'Ошибка поиска'], 422);
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'items'       => $result['items'] ?? [],
                'next_max_id' => $result['next_max_id'] ?? null
            ],
            'message' => 'OK'
        ]);
    }

    public function locations(Request $request): JsonResponse {
        $validated = $request->validate([
            'account_id' => 'required|integer',
            'query'      => 'required|string|min:1'
        ]);

        $account = $this->accountRepository->findByIdAndUser((int) $validated['account_id'], $request->user()->id);

        if (!$account) {
            return response()->json(['success' => false, 'error' => 'Аккаунт не найден'], 404);
        }

        if (!$account->session_data) {
            return response()->json(['success' => false, 'error' => 'Сессия не найдена'], 422);
        }

        $result = $this->instagramClient->searchLocations(
            $account->session_data,
            $validated['query']
        );

        if (empty($result['success'])) {
            return response()->json(['success' => false, 'error' => $result['error'] ?? 'Ошибка поиска мест'], 422);
        }

        return response()->json([
            'success' => true,
            'data'    => ['locations' => $result['locations'] ?? []],
            'message' => 'OK'
        ]);
    }

    public function locationMedias(Request $request): JsonResponse {
        $validated = $request->validate([
            'account_id'  => 'required|integer',
            'location_pk' => 'required|integer',
            'amount'      => 'nullable|integer|min:1|max:100',
            'next_max_id' => 'nullable|string'
        ]);

        $account = $this->accountRepository->findByIdAndUser((int) $validated['account_id'], $request->user()->id);

        if (!$account) {
            return response()->json(['success' => false, 'error' => 'Аккаунт не найден'], 404);
        }

        if (!$account->session_data) {
            return response()->json(['success' => false, 'error' => 'Сессия не найдена'], 422);
        }

        $result = $this->instagramClient->searchLocationMedias(
            $account->session_data,
            (int) $validated['location_pk'],
            (int) ($validated['amount'] ?? 30),
            $validated['next_max_id'] ?? null
        );

        if (empty($result['success'])) {
            return response()->json(['success' => false, 'error' => $result['error'] ?? 'Ошибка поиска медиа'], 422);
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'items'       => $result['items'] ?? [],
                'next_max_id' => $result['next_max_id'] ?? null
            ],
            'message' => 'OK'
        ]);
    }
}
