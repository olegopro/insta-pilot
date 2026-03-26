<?php

declare(strict_types=1);

namespace Tests\Unit\Jobs;

use App\Events\CommentGenerationProgress;
use App\Jobs\GenerateCommentJob;
use App\Models\AccountActivityLog;
use App\Services\ActivityLoggerServiceInterface;
use App\Services\LlmServiceInterface;
use Illuminate\Support\Facades\Event;
use RuntimeException;
use Tests\TestCase;

class GenerateCommentJobTest extends TestCase {
    private LlmServiceInterface $llmService;
    private ActivityLoggerServiceInterface $activityLogger;

    protected function setUp(): void {
        parent::setUp();

        $this->llmService     = $this->createMock(LlmServiceInterface::class);
        $this->activityLogger = $this->createMock(ActivityLoggerServiceInterface::class);
        $this->activityLogger->method('log')->willReturn($this->createMock(AccountActivityLog::class));
    }

    public function test_handle_broadcasts_downloading_and_analyzing_on_success(): void {
        Event::fake([CommentGenerationProgress::class]);

        $this->llmService->method('generateComment')->willReturn([
            'comment'      => 'Nice shot!',
            'llm_request'  => [],
            'llm_response' => [],
        ]);

        $job = new GenerateCommentJob('job-123', 'https://example.com/img.jpg', null);
        $job->handle($this->llmService, $this->activityLogger);

        Event::assertDispatched(
            CommentGenerationProgress::class,
            fn (CommentGenerationProgress $e) => $e->step === 'downloading' && $e->jobId === 'job-123'
        );
        Event::assertDispatched(
            CommentGenerationProgress::class,
            fn (CommentGenerationProgress $e) => $e->step === 'analyzing'
        );
    }

    public function test_handle_broadcasts_completed_with_comment(): void {
        Event::fake([CommentGenerationProgress::class]);

        $this->llmService->method('generateComment')->willReturn([
            'comment'      => 'Beautiful photo!',
            'llm_request'  => [],
            'llm_response' => [],
        ]);

        $job = new GenerateCommentJob('job-456', 'https://example.com/img.jpg', 'Sunset vibes');
        $job->handle($this->llmService, $this->activityLogger);

        Event::assertDispatched(
            CommentGenerationProgress::class,
            fn (CommentGenerationProgress $e) => $e->step === 'completed' && $e->comment === 'Beautiful photo!'
        );
    }

    public function test_handle_broadcasts_failed_on_exception(): void {
        Event::fake([CommentGenerationProgress::class]);

        $this->llmService->method('generateComment')->willThrowException(new RuntimeException('LLM error'));

        $job = new GenerateCommentJob('job-789', 'https://example.com/img.jpg', null);

        try {
            $job->handle($this->llmService, $this->activityLogger);
        } catch (RuntimeException) {
            // expected rethrow
        }

        Event::assertDispatched(
            CommentGenerationProgress::class,
            fn (CommentGenerationProgress $e) => $e->step === 'failed' && str_contains((string) $e->error, 'LLM error')
        );
    }

    public function test_handle_logs_success_when_account_and_user_provided(): void {
        Event::fake();

        $this->llmService->method('generateComment')->willReturn([
            'comment'      => 'Great!',
            'llm_request'  => ['provider' => 'openai'],
            'llm_response' => ['usage' => null],
        ]);

        $this->activityLogger->expects($this->once())->method('log');

        $job = new GenerateCommentJob('j1', 'https://example.com/img.jpg', null, accountId: 10, userId: 5);
        $job->handle($this->llmService, $this->activityLogger);
    }

    public function test_handle_does_not_log_when_account_id_null(): void {
        Event::fake();

        $this->llmService->method('generateComment')->willReturn([
            'comment'      => 'Nice!',
            'llm_request'  => [],
            'llm_response' => [],
        ]);

        $this->activityLogger->expects($this->never())->method('log');

        $job = new GenerateCommentJob('j2', 'https://example.com/img.jpg', null);
        $job->handle($this->llmService, $this->activityLogger);
    }

    public function test_handle_logs_error_on_failure_when_account_provided(): void {
        Event::fake();

        $this->llmService->method('generateComment')->willThrowException(new RuntimeException('fail'));
        $this->activityLogger->expects($this->once())->method('log');

        $job = new GenerateCommentJob('j3', 'https://example.com/img.jpg', null, accountId: 1, userId: 1);

        try {
            $job->handle($this->llmService, $this->activityLogger);
        } catch (RuntimeException) {
            // expected rethrow
        }
    }

    public function test_job_config(): void {
        $job = new GenerateCommentJob('id', 'url', null);

        $this->assertEquals(1, $job->tries);
        $this->assertEquals(90, $job->timeout);
    }
}
