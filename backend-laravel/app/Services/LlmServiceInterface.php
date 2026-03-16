<?php

declare(strict_types=1);

namespace App\Services;

interface LlmServiceInterface {
    /**
     * Сгенерировать комментарий к Instagram-посту.
     *
     * @param string $imageUrl URL изображения поста
     * @param string|null $captionText Текст описания поста (для контекста)
     * @return string Сгенерированный комментарий
     */
    public function generateComment(string $imageUrl, ?string $captionText = null): string;

    /**
     * Тест подключения к LLM API (простой текстовый промпт).
     */
    public function testConnection(string $provider, string $apiKey, string $modelName): bool;
}
