<?php

declare(strict_types=1);

namespace App\Services;

use App\Events\ActivityLogCreated;
use App\Models\AccountActivityLog;

class ActivityLoggerService implements ActivityLoggerServiceInterface {
    /** @var string[] */
    private const array SENSITIVE_KEYS = [
        'instagram_password',
        'session_data',
        'cookie',
        'token',
        'password',
    ];

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
    ): AccountActivityLog {
        $log = AccountActivityLog::create([
            'instagram_account_id' => $accountId,
            'user_id'              => $userId,
            'action'               => $action,
            'status'               => $status,
            'http_code'            => $httpCode,
            'endpoint'             => $endpoint,
            'request_payload'      => $requestPayload !== null ? $this->sanitize($requestPayload) : null,
            'response_summary'     => $responseSummary,
            'error_message'        => $errorMessage,
            'error_code'           => $errorCode,
            'duration_ms'          => $durationMs,
            'created_at'           => now(),
        ]);

        broadcast(new ActivityLogCreated($log));

        return $log;
    }

    private function sanitize(array $payload): array {
        return array_filter(
            $payload,
            static fn (string $key) => !\in_array($key, self::SENSITIVE_KEYS, true),
            ARRAY_FILTER_USE_KEY
        );
    }
}
