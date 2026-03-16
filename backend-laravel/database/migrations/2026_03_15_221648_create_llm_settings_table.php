<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('llm_settings', function (Blueprint $table) {
            $table->id();
            $table->string('provider')->unique();
            $table->text('api_key');
            $table->string('model_name');
            $table->text('system_prompt')->nullable();
            $table->string('tone')->default('friendly');
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('llm_settings');
    }
};
