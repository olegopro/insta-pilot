<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
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

    public function up(): void {
        Schema::table('llm_system_prompts', function (Blueprint $table) {
            $table->text('default_content')->nullable()->after('content');
        });

        DB::table('llm_system_prompts')
            ->where('key', 'default_instagram_comment')
            ->update(['default_content' => self::INSTAGRAM_COMMENT_DEFAULT]);
    }

    public function down(): void {
        Schema::table('llm_system_prompts', function (Blueprint $table) {
            $table->dropColumn('default_content');
        });
    }
};
