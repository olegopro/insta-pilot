<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\LlmSystemPrompt;

class LlmSystemPromptRepository implements LlmSystemPromptRepositoryInterface {
    public function findByKey(string $key): ?LlmSystemPrompt {
        return LlmSystemPrompt::where('key', $key)->first();
    }

    public function updateByKey(string $key, string $content): LlmSystemPrompt {
        $prompt = LlmSystemPrompt::where('key', $key)->firstOrFail();
        $prompt->update(['content' => $content]);

        return $prompt;
    }
}
