<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\ShowcaseMediaOverlay;
use App\Repositories\InstagramAccountRepositoryInterface;
use App\Repositories\ShowcaseOverlayRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Витрина (showcase), Phase 2 — запись локальной обёртки (overlay) поста.
 * Локальные пользовательские флаги/заметки/метки и порядок «доски» хранятся
 * в БД и примешиваются к данным из Instagram при чтении.
 */
final class ShowcaseOverlayController extends Controller {
    public function __construct(
        private readonly ShowcaseOverlayRepositoryInterface $overlayRepository,
        private readonly InstagramAccountRepositoryInterface $accountRepository
    ) {}

    /**
     * Обновить overlay-флаги одного поста.
     *
     * @param int    $accountId ID аккаунта в системе (не Instagram ID)
     * @param string $mediaPk   PK поста Instagram
     */
    public function updateOverlay(Request $request, int $accountId, string $mediaPk): JsonResponse {
        $account = $this->accountRepository->findByIdAndUser($accountId, $request->user()->id);

        if (!$account) {
            return response()->json([
                'success' => false,
                'error'   => 'Аккаунт не найден'
            ], 404);
        }

        $data = $request->validate([
            'is_ad'           => 'sometimes|boolean',
            'is_tracked'      => 'sometimes|boolean',
            'is_hidden_local' => 'sometimes|boolean',
            'note'            => 'sometimes|nullable|string',
            'labels'          => 'sometimes|nullable|array',
            'labels.*'        => 'string'
        ]);

        $overlay = $this->overlayRepository->upsertFlags($accountId, $request->user()->id, $mediaPk, $data);

        return response()->json([
            'success' => true,
            'data'    => ShowcaseMediaOverlay::toContractArray($overlay),
            'message' => 'OK'
        ]);
    }

    /**
     * Переупорядочить «доску» — проставить board_position набору постов.
     *
     * @param int $accountId ID аккаунта в системе (не Instagram ID)
     */
    public function reorderBoard(Request $request, int $accountId): JsonResponse {
        $account = $this->accountRepository->findByIdAndUser($accountId, $request->user()->id);

        if (!$account) {
            return response()->json([
                'success' => false,
                'error'   => 'Аккаунт не найден'
            ], 404);
        }

        $data = $request->validate([
            'order'              => 'required|array',
            'order.*.media_pk'   => 'required|string',
            'order.*.position'   => 'required|integer'
        ]);

        $this->overlayRepository->reorder($accountId, $request->user()->id, $data['order']);

        return response()->json([
            'success' => true,
            'message' => 'OK'
        ]);
    }
}
