<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\LlmSettingsRepositoryInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

class LlmService implements LlmServiceInterface {
    private const DEFAULT_SYSTEM_PROMPT = <<<'PROMPT'
        Ты — помощник для Instagram. Твоя задача — написать короткий, живой,
        естественный комментарий к посту на основе изображения и описания.

        Правила:
        - Комментарий должен быть на языке описания поста (или на английском, если описания нет)
        - Длина: 1-3 предложения
        - Без хэштегов, без эмодзи-спама
        - Выглядеть как реальный комментарий от живого человека
        - Не повторять описание поста дословно
        PROMPT;

    public function __construct(
        private readonly LlmSettingsRepositoryInterface $repository
    ) {}

    public function generateComment(string $imageUrl, ?string $captionText = null): array {
        $setting = $this->repository->getDefault();

        if ($setting === null) {
            throw new RuntimeException('LLM provider not configured. Please set a default provider in settings.');
        }

        $imageBase64 = $this->downloadImageAsBase64($imageUrl);

        $captionText = $setting->use_caption ? $captionText : null;

        $userText = $captionText
            ? "Caption: {$captionText}\n\nWrite a natural comment for this post."
            : 'Write a natural comment for this post.';

        $systemPrompt = $setting->system_prompt ?? self::DEFAULT_SYSTEM_PROMPT;

        if ($setting->tone) {
            $systemPrompt .= "\n\nТон комментария: {$setting->tone}";
        }

        $messages = [
            [
                'role'    => 'system',
                'content' => $systemPrompt
            ],
            [
                'role'    => 'user',
                'content' => [
                    [
                        'type'      => 'image_url',
                        'image_url' => ['url' => "data:image/jpeg;base64,{$imageBase64}"]
                    ],
                    [
                        'type' => 'text',
                        'text' => $userText
                    ]
                ]
            ]
        ];

        $result = $this->sendRequest(
            $setting->provider,
            $setting->api_key,
            $setting->model_name,
            $messages
        );

        return [
            'comment'      => $result['comment'],
            'llm_request'  => [
                'provider'      => $setting->provider,
                'model'         => $setting->model_name,
                'system_prompt' => $systemPrompt,
                'user_text'     => $userText,
                'image_url'     => $imageUrl,
                'use_caption'   => $setting->use_caption,
            ],
            'llm_response' => [
                'comment'       => $result['comment'],
                'usage'         => $result['usage'],
                'model'         => $result['model'],
                'finish_reason' => $result['finish_reason'],
            ],
        ];
    }

    public function testConnection(string $provider, string $apiKey, string $modelName): bool {
        $messages = [
            ['role' => 'user', 'content' => 'Say OK']
        ];

        try {
            $this->sendRequest($provider, $apiKey, $modelName, $messages, maxTokens: 10);

            return true;
        } catch (\Exception $e) {
            Log::warning('LLM test connection failed', [
                'provider' => $provider,
                'model'    => $modelName,
                'error'    => $e->getMessage()
            ]);

            return false;
        }
    }

    private function downloadImageAsBase64(string $url): string {
        $response = Http::timeout(30)->get($url);

        if (!$response->successful()) {
            throw new RuntimeException("Failed to download image: HTTP {$response->status()}");
        }

        $body = $response->body();

        if (strlen($body) > 10 * 1024 * 1024) {
            throw new RuntimeException('Image too large (max 10 MB)');
        }

        return base64_encode($body);
    }

    private function sendRequest(
        string $provider,
        string $apiKey,
        string $modelName,
        array $messages,
        int $maxTokens = 512
    ): array {
        $endpoint = match ($provider) {
            'glm'    => 'https://api.z.ai/api/paas/v4/chat/completions',
            'openai' => 'https://api.openai.com/v1/chat/completions',
            default  => throw new RuntimeException("Unknown LLM provider: {$provider}")
        };

        $payload = [
            'model'      => $modelName,
            'messages'   => $messages,
            'max_tokens' => $maxTokens
        ];

        if ($provider === 'glm') {
            $payload['thinking'] = ['type' => 'disabled'];
        }

        $response = Http::withToken($apiKey)
            ->timeout(60)
            ->post($endpoint, $payload);

        if (!$response->successful()) {
            throw new RuntimeException(
                "LLM API error [{$provider}]: HTTP {$response->status()} — " . Str::limit($response->body(), 500)
            );
        }

        $data = $response->json();

        $comment = $data['choices'][0]['message']['content']
            ?? throw new RuntimeException('Unexpected LLM response format: missing content');

        return [
            'comment'       => $comment,
            'usage'         => $data['usage'] ?? null,
            'model'         => $data['model'] ?? null,
            'finish_reason' => $data['choices'][0]['finish_reason'] ?? null,
        ];
    }
}
