<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\LlmSystemPrompt;

interface LlmSystemPromptRepositoryInterface {
    public function findByKey(string $key): ?LlmSystemPrompt;

    public function updateByKey(string $key, string $content): LlmSystemPrompt;
}
