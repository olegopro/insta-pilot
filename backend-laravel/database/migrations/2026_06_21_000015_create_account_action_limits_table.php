<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('account_action_limits', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('instagram_account_id')->constrained('instagram_accounts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('action');
            $table->integer('daily_limit');
            $table->integer('min_action_spacing_sec')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['instagram_account_id', 'action']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('account_action_limits');
    }
};
