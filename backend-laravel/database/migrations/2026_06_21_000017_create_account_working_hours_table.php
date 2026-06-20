<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('account_working_hours', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('instagram_account_id')->constrained('instagram_accounts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->json('schedule');
            $table->string('timezone')->default('UTC');
            $table->boolean('is_enabled')->default(true);
            $table->timestamps();

            $table->unique(['instagram_account_id']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('account_working_hours');
    }
};
