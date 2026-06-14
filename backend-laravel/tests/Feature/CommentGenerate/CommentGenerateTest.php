<?php

declare(strict_types=1);

namespace Tests\Feature\CommentGenerate;

use App\Jobs\GenerateCommentJob;
use App\Models\User;
use Illuminate\Support\Facades\Queue;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class CommentGenerateTest extends TestCase {
    private User $user;

    protected function setUp(): void {
        parent::setUp();
        $this->user = User::factory()->create();
        Queue::fake();
    }

    public function test_generate_dispatches_job_and_returns_job_id(): void {
        $response = $this->actingAs($this->user)
            ->postJson('/api/comments/generate', [
                'image_url' => 'https://example.com/photo.jpg',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['job_id']]);

        Queue::assertPushed(GenerateCommentJob::class);
    }

    public function test_generate_passes_correct_data_to_job(): void {
        $this->actingAs($this->user)
            ->postJson('/api/comments/generate', [
                'image_url'    => 'https://example.com/photo.jpg',
                'caption_text' => 'Beautiful sunset',
            ]);

        Queue::assertPushed(GenerateCommentJob::class, function (GenerateCommentJob $job) {
            return $job->imageUrl === 'https://example.com/photo.jpg'
                && $job->captionText === 'Beautiful sunset';
        });
    }

    #[DataProvider('invalidImageUrlProvider')]
    public function test_generate_returns_422_for_invalid_image_url(array $payload): void {
        $this->actingAs($this->user)
            ->postJson('/api/comments/generate', $payload)
            ->assertStatus(422);

        Queue::assertNothingPushed();
    }

    public static function invalidImageUrlProvider(): array {
        return [
            'empty body'  => [[]],
            'invalid url' => [['image_url' => 'not-a-url']]
        ];
    }
}
