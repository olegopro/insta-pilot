<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('account_target_interactions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('instagram_account_id')->constrained('instagram_accounts')->cascadeOnDelete();
            $table->unsignedBigInteger('target_user_pk');
            $table->string('action');
            $table->timestamp('last_touched_at');
            $table->timestamps();

            $table->unique(['instagram_account_id', 'target_user_pk', 'action']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('account_target_interactions');
    }
};
