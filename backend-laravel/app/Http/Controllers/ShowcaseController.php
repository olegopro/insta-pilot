<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Repositories\InstagramAccountRepositoryInterface;
use App\Services\InstagramClientServiceInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Витрина (showcase), Phase 1 — read-only обёртка над собственным
 * профилем/медиа аккаунта. Данные читаются из Python и отдаются как есть;
 * overlay-блок постов в Phase 1 содержит дефолтные значения (Phase 2
 * наполнит их из БД).
 */
final class ShowcaseController extends Controller {
    public function __construct(
        private readonly InstagramClientServiceInterface $instagramClient,
        private readonly InstagramAccountRepositoryInterface $accountRepository
    ) {}

    /**
     * Профиль собственного аккаунта.
     *
     * @param int $accountId ID аккаунта в системе (не Instagram ID)
     */
    public function profile(Request $request, int $accountId): JsonResponse {
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

        $result = $this->instagramClient->getOwnProfile($account->session_data, $account->id);

        if (empty($result['success'])) {
            return response()->json([
                'success' => false,
                'error'   => $result['error'] ?? 'Ошибка загрузки профиля'
            ], 422);
        }

        return response()->json([
            'success' => true,
            'data'    => $result,
            'message' => 'OK'
        ]);
    }

    /**
     * Страница медиа собственного аккаунта.
     *
     * К каждому посту примешивается дефолтный overlay-блок: в Phase 1 он
     * содержит пустые значения, в Phase 2 будет наполняться из БД.
     *
     * @param int $accountId ID аккаунта в системе (не Instagram ID)
     */
    public function medias(Request $request, int $accountId): JsonResponse {
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

        $amount = $request->query('amount') ? (int) $request->query('amount') : 12;
        $cursor = $request->query('cursor') ?: null;

        $result = $this->instagramClient->getOwnMedias($account->session_data, $cursor, $amount, $account->id);

        if (empty($result['success'])) {
            return response()->json([
                'success' => false,
                'error'   => $result['error'] ?? 'Ошибка загрузки медиа'
            ], 422);
        }

        $posts = array_map(
            fn (array $post): array => array_merge($post, ['overlay' => $this->defaultOverlay()]),
            $result['posts'] ?? []
        );

        return response()->json([
            'success' => true,
            'data'    => [
                'posts'          => $posts,
                'next_cursor'    => $result['next_cursor'] ?? null,
                'more_available' => $result['more_available'] ?? false
            ],
            'message' => 'OK'
        ]);
    }

    /**
     * Детали одного поста собственного аккаунта.
     *
     * @param int    $accountId ID аккаунта в системе (не Instagram ID)
     * @param string $mediaPk   PK поста Instagram
     */
    public function mediaInfo(Request $request, int $accountId, string $mediaPk): JsonResponse {
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

        $result = $this->instagramClient->getMediaInfo($account->session_data, $mediaPk, $account->id);

        if (empty($result['success'])) {
            return response()->json([
                'success' => false,
                'error'   => $result['error'] ?? 'Ошибка загрузки поста'
            ], 422);
        }

        return response()->json([
            'success' => true,
            'data'    => $result['post'] ?? null,
            'message' => 'OK'
        ]);
    }

    /**
     * Дефолтный overlay-блок поста (Phase 1). Phase 2 наполнит из БД.
     *
     * @return array<string, mixed>
     */
    private function defaultOverlay(): array {
        return [
            'board_position'  => null,
            'is_ad'           => false,
            'is_tracked'      => false,
            'is_hidden_local' => false,
            'note'            => null,
            'labels'          => null
        ];
    }
}
