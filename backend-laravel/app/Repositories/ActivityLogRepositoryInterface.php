<?php

declare(strict_types=1);

namespace App\Repositories;

use Illuminate\Support\Collection;

interface ActivityLogRepositoryInterface {
    /**
     * Логи аккаунта с фильтрами и cursor-пагинацией.
     *
     * @return array{ items: array, has_more_before: bool, has_more_after: bool, total: int, focused_id: int|null }
     */
    public function getByAccount(
        int $accountId,
        ?string $action = null,
        ?string $status = null,
        ?int $httpCode = null,
        ?string $dateFrom = null,
        ?string $dateTo = null,
        int $perPage = 50,
        ?int $beforeId = null,
        ?int $afterId = null,
        ?int $aroundId = null,
    ): array;

    /**
     * Агрегированная статистика по аккаунту.
     */
    public function getStatsByAccount(int $accountId): array;

    /**
     * Обзор всех аккаунтов пользователя (или всех для admin).
     */
    public function getSummary(?int $userId = null): Collection;

    /**
     * Удалить логи старше N дней.
     */
    public function pruneOlderThan(int $days): int;
}
