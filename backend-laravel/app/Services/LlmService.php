<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\LlmSettingsRepositoryInterface;
use App\Repositories\LlmSystemPromptRepositoryInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Сервис генерации комментариев через OpenAI Chat Completions API (и совместимый GLM).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * КАК УСТРОЕН ЗАПРОС К OPENAI CHAT COMPLETIONS API (POST /v1/chat/completions)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Тело запроса:
 * {
 *   "model":      "gpt-4o",
 *   "max_tokens": 512,
 *   "messages": [
 *     {
 *       "role":    "system",
 *       "content": "<системный промпт — одна строка или многострочный текст>"
 *     },
 *     {
 *       "role": "user",
 *       "content": [
 *         {
 *           "type":      "image_url",
 *           "image_url": { "url": "data:image/jpeg;base64,<BASE64>" }
 *         },
 *         {
 *           "type": "text",
 *           "text": "Caption: <текст поста>\n\nWrite a natural comment for this post."
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * ─────────────────────────────────────────
 * КАК СОБИРАЕТСЯ SYSTEM PROMPT (три слоя):
 * ─────────────────────────────────────────
 *
 * 1. Базовый промпт (llm_system_prompts, key = 'default_instagram_comment')
 *    — хранится в БД, read-only для пользователя.
 *    ~ 100–150 токенов.
 *
 * 2. Дополнительный промпт (llm_settings.system_prompt, опционально)
 *    — добавляется через "\n\n" после базового.
 *    Жёсткого лимита на поле нет — OpenAI не ограничивает длину отдельных полей content.
 *    Единственное ограничение — суммарный context window (см. таблицу ниже).
 *    Практический ориентир: ~2000 символов (≈500 токенов) достаточно для любых инструкций;
 *    больше — просто разбавляет системную инструкцию и снижает качество следования ей.
 *
 * 3. Тон (llm_settings.tone, опционально)
 *    — добавляется строкой "\n\nТон комментария: friendly" в конце.
 *    ~ 5 токенов.
 *
 * ─────────────────────────────────────
 * КАК ПЕРЕДАЁТСЯ ОПИСАНИЕ ПОСТА (user message):
 * ─────────────────────────────────────
 *
 * User message — массив из двух элементов:
 *   [0] image_url — изображение в формате base64 (data URI)
 *   [1] text      — "Caption: <описание>\n\nWrite a natural comment for this post."
 *                   Если use_caption = false или caption пустой — только вторая часть.
 *
 * Порядок элементов в user content не важен для модели.
 * Отдельного лимита на поле text нет — только суммарный context window.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ЛИМИТЫ ТОКЕНОВ (OpenAI, актуально на 2026-03)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Модель           | Контекст    | Max output
 * ─────────────────|─────────────|───────────
 * gpt-4o           | 128 000     | 4 096
 * gpt-4o-mini      | 128 000     | 4 096
 * gpt-4.1          | 1 000 000   | 32 768
 * gpt-4.1-mini     | 1 000 000   | 32 000
 *
 * Расход токенов на один запрос generateComment():
 *   — system prompt (базовый + доп. + тон)  ~150–650 токенов
 *   — изображение JPEG 1080px (high detail) ~850 токенов (765 плитки + 85 base)
 *   — caption Instagram (до 2200 символов)   ~800 токенов  (≈ 2.7 символа/токен)
 *   — user text ("Caption: ... Write a...")  ~10 токенов
 *   — ответ модели (1–3 предложения)         ~50–100 токенов
 *   ─────────────────────────────────────────────────────────
 *   ИТОГО                                   ~1860–2410 токенов  <<  128K
 *
 * Вывод: даже при максимально длинном caption и дополнительном system prompt
 * переполнения контекста не возникает ни на одной из поддерживаемых моделей.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GLM (api.z.ai) — совместимый с OpenAI формат
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Используется тот же JSON-формат messages.
 * Дополнительно передаётся { "thinking": { "type": "disabled" } } — отключает
 * режим цепочки рассуждений (CoT), который сильно увеличивает latency и расход токенов.
 */
class LlmService implements LlmServiceInterface {
    public function __construct(
        private readonly LlmSettingsRepositoryInterface $repository,
        private readonly LlmSystemPromptRepositoryInterface $systemPromptRepository
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

        $basePrompt = $this->systemPromptRepository->findByKey('default_instagram_comment')?->content
            ?? throw new RuntimeException('Base system prompt not configured');

        $systemPrompt = $basePrompt;

        if ($setting->system_prompt) {
            $systemPrompt .= "\n\n" . $setting->system_prompt;
        }

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
