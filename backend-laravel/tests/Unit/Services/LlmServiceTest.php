<?php

declare(strict_types=1);

namespace Tests\Unit\Services;

use App\Models\LlmSetting;
use App\Models\LlmSystemPrompt;
use App\Repositories\LlmSettingsRepositoryInterface;
use App\Repositories\LlmSystemPromptRepositoryInterface;
use App\Services\LlmService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\TestCase;

class LlmServiceTest extends TestCase {
    private LlmService $service;
    private LlmSettingsRepositoryInterface $settingsRepo;
    private LlmSystemPromptRepositoryInterface $promptRepo;

    /** Минимальный корректный ответ LLM API */
    private array $llmApiResponse = [
        'choices' => [
            ['message' => ['content' => 'Great photo!'], 'finish_reason' => 'stop']
        ],
        'usage' => ['prompt_tokens' => 100, 'completion_tokens' => 10],
        'model' => 'gpt-4o-mini',
    ];

    protected function setUp(): void {
        parent::setUp();

        $this->settingsRepo = $this->createMock(LlmSettingsRepositoryInterface::class);
        $this->promptRepo   = $this->createMock(LlmSystemPromptRepositoryInterface::class);
        $this->service      = new LlmService($this->settingsRepo, $this->promptRepo);
    }

    private function makeOpenAiSetting(array $override = []): LlmSetting {
        return LlmSetting::factory()->openai()->make(array_merge([
            'model_name'    => 'gpt-4o-mini',
            'system_prompt' => null,
            'tone'          => null,
            'use_caption'   => true,
        ], $override));
    }

    private function makeBasePrompt(string $content = 'Write a comment.'): LlmSystemPrompt {
        return new LlmSystemPrompt(['content' => $content]);
    }

    private function fakeImageAndLlm(array $llmResponse = []): void {
        Http::fake([
            'https://example.com/image.jpg'              => Http::response('IMAGEBYTES', 200),
            'https://api.openai.com/v1/chat/completions' => Http::response($llmResponse ?: $this->llmApiResponse, 200),
            'https://api.z.ai/*'                         => Http::response($llmResponse ?: $this->llmApiResponse, 200),
        ]);
    }

    // --- generateComment: базовая логика ---

    public function test_generate_comment_returns_comment_text(): void {
        $this->settingsRepo->method('getDefault')->willReturn($this->makeOpenAiSetting());
        $this->promptRepo->method('findByKey')->willReturn($this->makeBasePrompt());
        $this->fakeImageAndLlm();

        $result = $this->service->generateComment('https://example.com/image.jpg');

        $this->assertEquals('Great photo!', $result['comment']);
    }

    public function test_generate_comment_result_has_expected_keys(): void {
        $this->settingsRepo->method('getDefault')->willReturn($this->makeOpenAiSetting());
        $this->promptRepo->method('findByKey')->willReturn($this->makeBasePrompt());
        $this->fakeImageAndLlm();

        $result = $this->service->generateComment('https://example.com/image.jpg');

        $this->assertArrayHasKey('comment', $result);
        $this->assertArrayHasKey('llm_request', $result);
        $this->assertArrayHasKey('llm_response', $result);
    }

    public function test_generate_comment_downloads_image_as_base64(): void {
        $this->settingsRepo->method('getDefault')->willReturn($this->makeOpenAiSetting());
        $this->promptRepo->method('findByKey')->willReturn($this->makeBasePrompt());
        $this->fakeImageAndLlm();

        $this->service->generateComment('https://example.com/image.jpg');

        Http::assertSent(function (Request $request) {
            if ($request->url() !== 'https://api.openai.com/v1/chat/completions') {
                return false;
            }

            $content  = $request['messages'][1]['content'];
            $imageUrl = $content[0]['image_url']['url'] ?? '';

            return str_starts_with($imageUrl, 'data:image/jpeg;base64,');
        });
    }

    // --- system prompt composition ---

    public function test_system_prompt_includes_base_plus_additional_plus_tone(): void {
        $setting = $this->makeOpenAiSetting(['system_prompt' => 'Be concise.', 'tone' => 'professional']);

        $this->settingsRepo->method('getDefault')->willReturn($setting);
        $this->promptRepo->method('findByKey')->willReturn($this->makeBasePrompt('Base prompt.'));
        $this->fakeImageAndLlm();

        $this->service->generateComment('https://example.com/image.jpg');

        Http::assertSent(function (Request $request) {
            if ($request->url() !== 'https://api.openai.com/v1/chat/completions') {
                return false;
            }

            $systemContent = $request['messages'][0]['content'];

            return str_contains($systemContent, 'Base prompt.')
                && str_contains($systemContent, 'Be concise.')
                && str_contains($systemContent, 'professional');
        });
    }

    public function test_system_prompt_without_additional_system_prompt(): void {
        $this->settingsRepo->method('getDefault')->willReturn($this->makeOpenAiSetting(['system_prompt' => null]));
        $this->promptRepo->method('findByKey')->willReturn($this->makeBasePrompt('Base only.'));
        $this->fakeImageAndLlm();

        $this->service->generateComment('https://example.com/image.jpg');

        Http::assertSent(function (Request $request) {
            if ($request->url() !== 'https://api.openai.com/v1/chat/completions') {
                return false;
            }

            $systemContent = $request['messages'][0]['content'];

            return $systemContent === 'Base only.';
        });
    }

    public function test_system_prompt_without_tone(): void {
        $this->settingsRepo->method('getDefault')->willReturn($this->makeOpenAiSetting(['tone' => null]));
        $this->promptRepo->method('findByKey')->willReturn($this->makeBasePrompt('Base.'));
        $this->fakeImageAndLlm();

        $this->service->generateComment('https://example.com/image.jpg');

        Http::assertSent(function (Request $request) {
            if ($request->url() !== 'https://api.openai.com/v1/chat/completions') {
                return false;
            }

            $systemContent = $request['messages'][0]['content'];

            return !str_contains($systemContent, 'Тон комментария');
        });
    }

    // --- use_caption ---

    public function test_use_caption_true_includes_caption_in_user_text(): void {
        $this->settingsRepo->method('getDefault')->willReturn($this->makeOpenAiSetting(['use_caption' => true]));
        $this->promptRepo->method('findByKey')->willReturn($this->makeBasePrompt());
        $this->fakeImageAndLlm();

        $this->service->generateComment('https://example.com/image.jpg', 'Sunset in Paris');

        Http::assertSent(function (Request $request) {
            if ($request->url() !== 'https://api.openai.com/v1/chat/completions') {
                return false;
            }

            $textContent = $request['messages'][1]['content'][1]['text'];

            return str_contains($textContent, 'Caption: Sunset in Paris');
        });
    }

    public function test_use_caption_false_excludes_caption(): void {
        $this->settingsRepo->method('getDefault')->willReturn($this->makeOpenAiSetting(['use_caption' => false]));
        $this->promptRepo->method('findByKey')->willReturn($this->makeBasePrompt());
        $this->fakeImageAndLlm();

        $this->service->generateComment('https://example.com/image.jpg', 'Sunset in Paris');

        Http::assertSent(function (Request $request) {
            if ($request->url() !== 'https://api.openai.com/v1/chat/completions') {
                return false;
            }

            $textContent = $request['messages'][1]['content'][1]['text'];

            return !str_contains($textContent, 'Caption:');
        });
    }

    // --- provider formats ---

    public function test_openai_request_does_not_include_thinking(): void {
        $this->settingsRepo->method('getDefault')->willReturn($this->makeOpenAiSetting());
        $this->promptRepo->method('findByKey')->willReturn($this->makeBasePrompt());
        $this->fakeImageAndLlm();

        $this->service->generateComment('https://example.com/image.jpg');

        Http::assertSent(function (Request $request) {
            if ($request->url() !== 'https://api.openai.com/v1/chat/completions') {
                return false;
            }

            return !isset($request['thinking']);
        });
    }

    public function test_glm_request_includes_thinking_disabled(): void {
        $setting = LlmSetting::factory()->glm()->make([
            'system_prompt' => null,
            'tone'          => null,
            'use_caption'   => true,
        ]);

        $this->settingsRepo->method('getDefault')->willReturn($setting);
        $this->promptRepo->method('findByKey')->willReturn($this->makeBasePrompt());

        Http::fake([
            'https://example.com/image.jpg' => Http::response('IMAGEBYTES', 200),
            'https://api.z.ai/*'            => Http::response($this->llmApiResponse, 200),
        ]);

        $this->service->generateComment('https://example.com/image.jpg');

        Http::assertSent(function (Request $request) {
            if (!str_contains($request->url(), 'api.z.ai')) {
                return false;
            }

            return isset($request['thinking']['type'])
                && $request['thinking']['type'] === 'disabled';
        });
    }

    // --- error cases ---

    public function test_throws_when_no_default_setting(): void {
        $this->settingsRepo->method('getDefault')->willReturn(null);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/not configured/i');

        $this->service->generateComment('https://example.com/image.jpg');
    }

    public function test_throws_when_image_download_fails(): void {
        $this->settingsRepo->method('getDefault')->willReturn($this->makeOpenAiSetting());
        $this->promptRepo->method('findByKey')->willReturn($this->makeBasePrompt());

        Http::fake(['https://example.com/image.jpg' => Http::response('', 404)]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/Failed to download/i');

        $this->service->generateComment('https://example.com/image.jpg');
    }

    public function test_throws_when_llm_api_returns_error(): void {
        $this->settingsRepo->method('getDefault')->willReturn($this->makeOpenAiSetting());
        $this->promptRepo->method('findByKey')->willReturn($this->makeBasePrompt());

        Http::fake([
            'https://example.com/image.jpg'              => Http::response('IMAGEBYTES', 200),
            'https://api.openai.com/v1/chat/completions' => Http::response(['error' => 'invalid_api_key'], 401),
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/LLM API error/i');

        $this->service->generateComment('https://example.com/image.jpg');
    }

    // --- testConnection ---

    public function test_test_connection_returns_true_on_success(): void {
        Http::fake(['https://api.openai.com/v1/chat/completions' => Http::response($this->llmApiResponse, 200)]);

        $result = $this->service->testConnection('openai', 'sk-test', 'gpt-4o-mini');

        $this->assertTrue($result);
    }

    public function test_test_connection_returns_false_on_api_error(): void {
        Http::fake(['https://api.openai.com/v1/chat/completions' => Http::response(['error' => 'Unauthorized'], 401)]);

        $result = $this->service->testConnection('openai', 'bad-key', 'gpt-4o-mini');

        $this->assertFalse($result);
    }

    public function test_test_connection_returns_false_for_unknown_provider(): void {
        $result = $this->service->testConnection('unknown-provider', 'key', 'model');

        $this->assertFalse($result);
    }
}
