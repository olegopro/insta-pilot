<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AccountActivityLog;

interface ActivityLoggerServiceInterface {
    public function log(
        int $accountId,
        int $userId,
        string $action,
        string $status,
        ?int $httpCode = null,
        ?string $endpoint = null,
        ?array $requestPayload = null,
        ?array $responseSummary = null,
        ?string $errorMessage = null,
        ?string $errorCode = null,
        ?int $durationMs = null,
    ): AccountActivityLog;

    /**
     * @param array<int, array{
     *     action: string,
     *     status: string,
     *     http_code?: int|null,
     *     endpoint?: string|null,
     *     request_payload?: array<string, mixed>|null,
     *     response_summary?: array<string, mixed>|null
     * }> $entries
     * @return AccountActivityLog[]
     */
    public function logBatch(
        int $accountId,
        int $userId,
        array $entries,
    ): array;
}
