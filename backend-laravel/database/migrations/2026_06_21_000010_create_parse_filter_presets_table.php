<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('parse_filter_presets', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->string('source_type');
            $table->json('source_value');
            $table->integer('followers_min')->nullable();
            $table->integer('followers_max')->nullable();
            $table->integer('following_min')->nullable();
            $table->integer('following_max')->nullable();
            $table->integer('last_post_max_days')->nullable();
            $table->integer('likes_sum_min')->nullable();
            $table->integer('likes_avg_min')->nullable();
            $table->integer('likes_avg_max')->nullable();
            $table->json('whitelist_words')->nullable();
            $table->json('blacklist_words')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('parse_filter_presets');
    }
};
