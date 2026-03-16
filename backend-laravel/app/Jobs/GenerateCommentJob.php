<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Events\CommentGenerationProgress;
use App\Services\LlmServiceInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

class GenerateCommentJob implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 1;
    public int $timeout = 90;

    public function __construct(
        public readonly string $jobId,
        public readonly string $imageUrl,
        public readonly ?string $captionText
    ) {}

    public function handle(LlmServiceInterface $llmService): void {
        try {
            broadcast(new CommentGenerationProgress($this->jobId, 'downloading'));

            broadcast(new CommentGenerationProgress($this->jobId, 'analyzing'));
            $comment = $llmService->generateComment($this->imageUrl, $this->captionText);

            broadcast(new CommentGenerationProgress($this->jobId, 'completed', comment: $comment));

        } catch (\Exception $e) {
            broadcast(new CommentGenerationProgress(
                $this->jobId,
                'failed',
                error: $e->getMessage()
            ));
            throw $e;
        }
    }
}
