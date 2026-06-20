<?php

declare(strict_types=1);

namespace App\Services\Automation;

use App\Contracts\ActionPluginInterface;
use App\Models\AutomationActionItem;
use App\Models\InstagramAccount;
use App\Services\InstagramClientServiceInterface;
use App\Services\LlmServiceInterface;
use RuntimeException;

final class CommentActionPlugin implements ActionPluginInterface {
    public function __construct(
        private readonly LlmServiceInterface $llmService,
        private readonly InstagramClientServiceInterface $instagramClient
    ) {}

    public function key(): string {
        return 'comment';
    }

    public function limitKey(): string {
        return 'comment';
    }

    public function estimatedCost(): int {
        return 1;
    }

    public function resolve(AutomationActionItem $item): array {
        $payload = $item->payload ?? [];

        if (isset($payload['comment_text']) && is_string($payload['comment_text']) && $payload['comment_text'] !== '') {
            return [
                ...$payload,
                'media_id' => $item->media_id,
                'media_pk' => $item->media_pk
            ];
        }

        $imageUrl = $this->imageUrl($item, $payload);
        $caption = $payload['media_caption'] ?? $item->parsedTarget?->media_caption;
        $result = $this->llmService->generateComment($imageUrl, is_string($caption) ? $caption : null);
        $comment = (string) $result['comment'];

        $payload = [
            ...$payload,
            'comment_text' => $comment,
            'llm_request' => $result['llm_request'] ?? null,
            'llm_response' => $result['llm_response'] ?? null,
            'image_url' => $imageUrl,
            'media_caption' => $caption
        ];

        $item->forceFill(['payload' => $payload])->save();

        return [
            ...$payload,
            'media_id' => $item->media_id,
            'media_pk' => $item->media_pk
        ];
    }

    public function execute(InstagramAccount $account, array $resolved, int $userId): array {
        $mediaId = $resolved['media_id'] ?? null;
        $comment = $resolved['comment_text'] ?? null;

        if (!is_string($mediaId) || $mediaId === '') {
            throw new RuntimeException('Automation comment action requires media_id.');
        }

        if (!is_string($comment) || $comment === '') {
            throw new RuntimeException('Automation comment action requires comment_text.');
        }

        return $this->instagramClient->commentMedia(
            (string) $account->session_data,
            (int) $account->id,
            $mediaId,
            $comment,
            $userId
        );
    }

    public function reconcile(AutomationActionItem $item): string {
        return 'needs_review';
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function imageUrl(AutomationActionItem $item, array $payload): string {
        $metrics = $item->parsedTarget?->metrics_snapshot ?? [];

        foreach (['image_url', 'thumbnail_url', 'media_thumbnail_url'] as $key) {
            $value = $payload[$key] ?? $metrics[$key] ?? null;

            if (is_string($value) && $value !== '') {
                return $value;
            }
        }

        throw new RuntimeException('Automation comment action requires image_url or thumbnail_url in payload.');
    }
}
