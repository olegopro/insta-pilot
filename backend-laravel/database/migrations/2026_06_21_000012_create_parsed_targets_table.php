<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('parsed_targets', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('parse_run_id')->constrained('parse_runs')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('target_user_pk');
            $table->string('target_username');
            $table->string('target_full_name')->nullable();
            $table->text('target_profile_pic_url')->nullable();
            $table->integer('follower_count')->nullable();
            $table->integer('following_count')->nullable();
            $table->integer('media_count')->nullable();
            $table->boolean('is_private')->default(false);
            $table->boolean('is_verified')->default(false);
            $table->unsignedBigInteger('media_pk')->nullable();
            $table->string('media_id')->nullable();
            $table->text('media_caption')->nullable();
            $table->integer('media_like_count')->nullable();
            $table->integer('media_comment_count')->nullable();
            $table->timestamp('media_taken_at')->nullable();
            $table->json('metrics_snapshot');
            $table->string('status')->default('kept');
            $table->timestamps();

            $table->unique(['parse_run_id', 'target_user_pk']);
            $table->index(['parse_run_id', 'status']);
            $table->index(['user_id', 'id']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('parsed_targets');
    }
};
