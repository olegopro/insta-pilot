<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('parse_runs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('instagram_account_id')->constrained('instagram_accounts')->cascadeOnDelete();
            $table->foreignId('parse_filter_preset_id')->nullable()->constrained('parse_filter_presets')->nullOnDelete();
            $table->string('mode');
            $table->string('source_type');
            $table->json('source_value');
            $table->json('filters_snapshot');
            $table->integer('target_limit');
            $table->string('status');
            $table->integer('scanned_count')->default(0);
            $table->integer('collected_count')->default(0);
            $table->json('next_cursor')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'id']);
            $table->index(['instagram_account_id', 'id']);
            $table->index('status');
        });
    }

    public function down(): void {
        Schema::dropIfExists('parse_runs');
    }
};
