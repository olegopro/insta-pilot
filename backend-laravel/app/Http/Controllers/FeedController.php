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

    /**
     * Загрузить ленту Instagram для аккаунта.
     *
     * Поддерживает два режима:
     *   — Первая страница: запрос без параметров → cold_start_fetch в Python
     *   — Следующие страницы: запрос с max_id + seen_posts → pagination в Python
     *
     * Пагинация Instagram работает не как обычный курсор — сервер требует
     * передавать список уже просмотренных постов (seen_posts), иначе возвращает
     * те же самые посты повторно. Фронт накапливает seen_posts и передаёт их
     * в каждом запросе за следующей страницей.
     *
     * Схема:
     *   Vue (feedStore) → GET /api/feed/{id}?max_id=...&seen_posts=id1,id2,...
     *     → FeedController → InstagramClientService
     *       → Python /account/feed → private_request feed/timeline/
     *
     * @param int     $accountId  ID аккаунта в системе (не Instagram ID)
     * @param Request $request    Параметры: max_id (курсор), seen_posts (через запятую)
     */
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

        // Курсор для следующей страницы — непрозрачная строка от Instagram.
        // Отсутствует при первом запросе → Python делает cold_start_fetch.
        $maxId = $request->query('max_id') ?: null;

        // Comma-separated список media_id (формат pk_{user_pk}) уже показанных постов.
        // Фронт накапливает их из каждого ответа и передаёт при следующем запросе.
        // Python формирует из них feed_view_info и seen_posts для запроса к Instagram.
        $seenPosts = $request->query('seen_posts') ?: null;
        $reason    = $request->query('reason') ?: null;
        $minPosts  = $request->query('min_posts') ? (int) $request->query('min_posts') : null;

        $result = $this->instagramClient->getFeed(
            $account->session_data,
            $maxId,
            $seenPosts,
            $reason,
            $minPosts
        );

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
                'next_max_id'    => $result['next_max_id'] ?? null,  // курсор для следующей страницы
                'more_available' => $result['more_available'] ?? false
            ],
            'message' => 'OK'
        ]);
    }

    /**
     * Поставить лайк на пост.
     *
     * @param int     $accountId  ID аккаунта в системе
     * @param Request $request    Тело: media_id (pk_{user_pk} формат Instagram)
     */
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
