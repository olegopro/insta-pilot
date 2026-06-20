<?php

declare(strict_types=1);

namespace App\Services\Automation;

use App\Contracts\ActionPluginInterface;
use App\Models\AutomationActionItem;
use App\Models\InstagramAccount;
use App\Services\InstagramClientServiceInterface;
use RuntimeException;

final class LikeActionPlugin implements ActionPluginInterface {
    public function __construct(
        private readonly InstagramClientServiceInterface $instagramClient
    ) {}

    public function key(): string {
        return 'like';
    }

    public function limitKey(): string {
        return 'like';
    }

    public function estimatedCost(): int {
        return 1;
    }

    public function resolve(AutomationActionItem $item): array {
        return [
            ...($item->payload ?? []),
            'media_id' => $item->media_id,
            'media_pk' => $item->media_pk
        ];
    }

    public function execute(InstagramAccount $account, array $resolved, int $userId): array {
        $mediaId = $resolved['media_id'] ?? null;

        if (!is_string($mediaId) || $mediaId === '') {
            throw new RuntimeException('Automation like action requires media_id.');
        }

        $result = $this->instagramClient->addLike(
            (string) $account->session_data,
            $mediaId,
            (int) $account->id,
            $userId
        );

        if (($result['success'] ?? false) === false && $this->isAlreadyLiked($result)) {
            return [
                ...$result,
                'success' => true,
                'already_liked' => true
            ];
        }

        return $result;
    }

    public function reconcile(AutomationActionItem $item): string {
        return 'retry';
    }

    /**
     * @param array<string, mixed> $result
     */
    private function isAlreadyLiked(array $result): bool {
        $error = mb_strtolower((string) ($result['error'] ?? ''));
        $code = mb_strtolower((string) ($result['error_code'] ?? ''));

        return str_contains($error, 'already') && str_contains($error, 'like')
            || str_contains($code, 'already') && str_contains($code, 'like');
    }
}
