<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('automation_action_items', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('automation_task_id')->constrained('automation_tasks')->cascadeOnDelete();
            $table->foreignId('instagram_account_id')->constrained('instagram_accounts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('parsed_target_id')->nullable()->constrained('parsed_targets')->nullOnDelete();
            $table->string('action_type');
            $table->unsignedBigInteger('target_user_pk');
            $table->unsignedBigInteger('media_pk')->nullable();
            $table->string('media_id')->nullable();
            $table->json('payload');
            $table->json('result')->nullable();
            $table->string('status')->default('pending');
            $table->timestamp('run_at');
            $table->uuid('claim_token')->nullable();
            $table->timestamp('claimed_at')->nullable();
            $table->timestamp('claim_expires_at')->nullable();
            $table->timestamp('quota_reserved_at')->nullable();
            $table->integer('attempts')->default(0);
            $table->string('error_code')->nullable();
            $table->text('error_message')->nullable();
            $table->foreignId('activity_log_id')->nullable()->constrained('account_activity_logs')->nullOnDelete();
            $table->timestamp('executed_at')->nullable();
            $table->timestamps();

            $table->unique(['instagram_account_id', 'action_type', 'media_pk']);
            $table->index(['status', 'run_at']);
            $table->index(['automation_task_id', 'status']);
            $table->index(['instagram_account_id', 'status']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('automation_action_items');
    }
};
