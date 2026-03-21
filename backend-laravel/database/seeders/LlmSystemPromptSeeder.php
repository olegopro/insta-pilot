<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\LlmSystemPrompt;
use Illuminate\Database\Seeder;

class LlmSystemPromptSeeder extends Seeder {
    private const INSTAGRAM_COMMENT_DEFAULT = <<<'PROMPT'
Ты — помощник для Instagram. Твоя задача — написать короткий, живой,
естественный комментарий к посту на основе изображения и описания.

Правила:
- Комментарий должен быть на языке описания поста (или на английском, если описания нет)
- Длина: 1-3 предложения
- Без хэштегов, без эмодзи-спама
- Выглядеть как реальный комментарий от живого человека
- Не повторять описание поста дословно
PROMPT;

    public function run(): void {
        LlmSystemPrompt::firstOrCreate(
            ['key' => 'default_instagram_comment'],
            [
                'title'           => 'Базовый системный промпт',
                'content'         => self::INSTAGRAM_COMMENT_DEFAULT,
                'default_content' => self::INSTAGRAM_COMMENT_DEFAULT
            ]
        );
    }
}
