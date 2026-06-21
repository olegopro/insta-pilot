<?php

declare(strict_types=1);

namespace App\Services\Automation;

use App\Contracts\ActionPluginInterface;
use App\Models\AutomationActionItem;
use App\Models\InstagramAccount;
use App\Services\InstagramClientServiceInterface;
use RuntimeException;

final class UnfollowActionPlugin implements ActionPluginInterface {
    public function __construct(
        private readonly InstagramClientServiceInterface $instagramClient
    ) {}

    public function key(): string {
        return 'unfollow';
    }

    public function limitKey(): string {
        return 'unfollow';
    }

    public function estimatedCost(): int {
        return 1;
    }

    public function resolve(AutomationActionItem $item): array {
        return [
            ...($item->payload ?? []),
            'target_user_pk' => $item->target_user_pk
        ];
    }

    public function execute(InstagramAccount $account, array $resolved, int $userId): array {
        $targetUserPk = $resolved['target_user_pk'] ?? null;

        if (!is_numeric($targetUserPk) || (string) $targetUserPk === '') {
            throw new RuntimeException('Automation unfollow action requires target_user_pk.');
        }

        return $this->instagramClient->unfollowUser(
            (string) $account->session_data,
            (string) $targetUserPk,
            (int) $account->id,
            $userId
        );
    }

    public function reconcile(AutomationActionItem $item): string {
        return 'needs_review';
    }
}
