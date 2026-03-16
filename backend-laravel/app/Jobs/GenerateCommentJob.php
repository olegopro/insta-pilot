<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Events\CommentGenerationProgress;
use App\Services\ActivityLoggerServiceInterface;
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
        public readonly ?string $captionText,
        public readonly ?int $accountId = null,
        public readonly ?int $userId = null,
    ) {}

    public function handle(LlmServiceInterface $llmService, ActivityLoggerServiceInterface $activityLogger): void {
        $start = microtime(true);

        try {
            broadcast(new CommentGenerationProgress($this->jobId, 'downloading'));

            broadcast(new CommentGenerationProgress($this->jobId, 'analyzing'));
            $result  = $llmService->generateComment($this->imageUrl, $this->captionText);
            $comment = (string) $result['comment'];

            $durationMs = (int) ((microtime(true) - $start) * 1000);

            if ($this->accountId !== null && $this->userId !== null) {
                $activityLogger->log(
                    accountId:       $this->accountId,
                    userId:          $this->userId,
                    action:          'generate_comment',
                    status:          'success',
                    requestPayload:  [
                        'image_url'    => $this->imageUrl,
                        'caption_text' => $this->captionText,
                        'llm_request'  => $result['llm_request'],
                    ],
                    responseSummary: [
                        'comment_length' => mb_strlen($comment),
                        'comment'        => $comment,
                        'llm_response'   => $result['llm_response'],
                    ],
                    durationMs: $durationMs,
                );
            }

            broadcast(new CommentGenerationProgress($this->jobId, 'completed', comment: $comment));

        } catch (\Exception $e) {
            $durationMs = (int) ((microtime(true) - $start) * 1000);

            if ($this->accountId !== null && $this->userId !== null) {
                $activityLogger->log(
                    accountId:    $this->accountId,
                    userId:       $this->userId,
                    action:       'generate_comment',
                    status:       'error',
                    errorMessage: $e->getMessage(),
                    durationMs:   $durationMs,
                );
            }

            broadcast(new CommentGenerationProgress(
                $this->jobId,
                'failed',
                error: $e->getMessage()
            ));
            throw $e;
        }
    }
}
