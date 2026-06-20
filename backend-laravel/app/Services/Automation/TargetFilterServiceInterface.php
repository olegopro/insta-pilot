<?php

declare(strict_types=1);

namespace App\Services\Automation;

interface TargetFilterServiceInterface {
    /**
     * Применяет комбо-фильтры к обогащённым целям.
     *
     * @param array<int, array<string, mixed>> $enriched Цели из /parse/targets/enrich
     * @param array<string, mixed>             $filters  Снимок порогов (filters_snapshot)
     * @return array<int, array{target: array<string, mixed>, passed: bool, reason?: string}>
     */
    public function applyFilters(array $enriched, array $filters): array;
}
