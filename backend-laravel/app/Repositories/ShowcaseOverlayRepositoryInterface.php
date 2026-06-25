<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\ShowcaseMediaOverlay;
use Illuminate\Support\Collection;

interface ShowcaseOverlayRepositoryInterface {
    /**
     * Все overlay аккаунта, индексированные по media_pk.
     *
     * @return Collection<string, ShowcaseMediaOverlay>
     */
    public function findForAccount(int $accountId): Collection;

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
