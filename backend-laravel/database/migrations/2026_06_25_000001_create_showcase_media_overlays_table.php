<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('showcase_media_overlays', function (Blueprint $table) {
            $table->id();
            $table->foreignId('instagram_account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('media_pk');
            $table->string('media_id')->nullable();
            $table->integer('board_position')->nullable();
            $table->boolean('is_ad')->default(false);
            $table->boolean('is_tracked')->default(false);
            $table->boolean('is_hidden_local')->default(false);
            $table->boolean('is_pinned_cache')->default(false);
            $table->text('note')->nullable();
            $table->json('labels')->nullable();
            $table->json('ig_snapshot')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();

            $table->unique(['instagram_account_id', 'media_pk']);
            $table->index(['user_id', 'id']);
            $table->index(['instagram_account_id', 'board_position']);
            $table->index(['instagram_account_id', 'is_ad']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('showcase_media_overlays');
    }
};
