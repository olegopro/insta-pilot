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
}
