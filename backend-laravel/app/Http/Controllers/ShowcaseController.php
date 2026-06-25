<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\InstagramAccount;
use App\Models\ShowcaseMediaOverlay;
use App\Repositories\InstagramAccountRepositoryInterface;
use App\Repositories\ShowcaseOverlayRepositoryInterface;
use App\Services\InstagramClientServiceInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Витрина (showcase) — read-only обёртка над собственным профилем/медиа
 * аккаунта. Данные читаются из Python и отдаются как есть; к каждому посту
 * примешивается overlay-блок (Phase 2 наполняет его локальными данными из БД).
 */
final class ShowcaseController extends Controller {
    public function __construct(
        private readonly InstagramClientServiceInterface $instagramClient,
        private readonly InstagramAccountRepositoryInterface $accountRepository,
        private readonly ShowcaseOverlayRepositoryInterface $overlayRepository
    ) {}

    /**
     * Профиль собственного аккаунта.
     *
     * @param int $accountId ID аккаунта в системе (не Instagram ID)
     */
    public function profile(Request $request, int $accountId): JsonResponse {
        $account = $this->resolveAccount($request, $accountId);

        if ($account instanceof JsonResponse) {
            return $account;
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
     * К каждому посту примешивается overlay-блок: локальные пользовательские
     * флаги/заметки/метки и порядок из БД (`showcase_media_overlays`). Если
     * для поста нет строки overlay — отдаются дефолтные значения.
     *
     * @param int $accountId ID аккаунта в системе (не Instagram ID)
     */
    public function medias(Request $request, int $accountId): JsonResponse {
        $account = $this->resolveAccount($request, $accountId);

        if ($account instanceof JsonResponse) {
            return $account;
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

        $resultPosts = $result['posts'] ?? [];

        // Грузим overlay только для постов текущей страницы (не весь аккаунт).
        $mediaPks = array_map(
            static fn (array $post): string => (string) ($post['pk'] ?? ''),
            $resultPosts
        );
        $overlays = $this->overlayRepository->findForMedias($accountId, $mediaPks);

        $posts = array_map(
            static fn (array $post): array => array_merge(
                $post,
                ['overlay' => ShowcaseMediaOverlay::toContractArray($overlays->get((string) ($post['pk'] ?? '')))]
            ),
            $resultPosts
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
        $account = $this->resolveAccount($request, $accountId);

        if ($account instanceof JsonResponse) {
            return $account;
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
     * Найти собственный аккаунт пользователя ИЛИ вернуть готовый ответ-ошибку.
     * 404 — аккаунт не найден/чужой; 422 — нет session_data.
     */
    private function resolveAccount(Request $request, int $accountId): InstagramAccount | JsonResponse {
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

        return $account;
    }
}
