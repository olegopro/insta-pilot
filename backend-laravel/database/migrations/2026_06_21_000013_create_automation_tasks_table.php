<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('automation_tasks', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('instagram_account_id')->constrained('instagram_accounts')->cascadeOnDelete();
            $table->foreignId('parse_run_id')->nullable()->constrained('parse_runs')->nullOnDelete();
            $table->string('mode');
            $table->string('action_type');
            $table->json('action_config');
            $table->integer('target_count');
            $table->integer('spread_seconds')->default(3600);
            $table->integer('jitter_seconds')->nullable();
            $table->boolean('respect_working_hours')->default(true);
            $table->string('status');
            $table->integer('items_total')->default(0);
            $table->integer('items_done')->default(0);
            $table->integer('items_failed')->default(0);
            $table->integer('items_skipped')->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'id']);
            $table->index(['instagram_account_id', 'status']);
            $table->index('status');
        });
    }

    public function down(): void {
        Schema::dropIfExists('automation_tasks');
    }
};
