<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\ShowcaseMediaOverlay;
use Illuminate\Support\Collection;

interface ShowcaseOverlayRepositoryInterface {
    /**
     * Overlay постов текущей страницы, индексированные по media_pk.
     * Грузит только строки для переданных media_pk (не весь аккаунт).
     *
     * @param array<int, string> $mediaPks
     * @return Collection<string, ShowcaseMediaOverlay>
     */
    public function findForMedias(int $accountId, array $mediaPks): Collection;

    /**
     * Создать/обновить overlay-флаги поста. Заполняются только
     * переданные ключи из $attrs (is_ad, is_tracked, is_hidden_local,
     * note, labels).
     *
     * @param array<string, mixed> $attrs
     */
    public function upsertFlags(int $accountId, int $userId, string $mediaPk, array $attrs): ShowcaseMediaOverlay;

    /**
     * Проставить board_position для набора постов в рамках одной транзакции.
     *
     * @param array<int, array{media_pk: string, position: int}> $order
     */
    public function reorder(int $accountId, int $userId, array $order): void;
}
