<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('account_action_counters', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('instagram_account_id')->constrained('instagram_accounts')->cascadeOnDelete();
            $table->string('action');
            $table->date('local_date');
            $table->integer('used')->default(0);
            $table->timestamps();

            $table->unique(['instagram_account_id', 'action', 'local_date']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('account_action_counters');
    }
};
