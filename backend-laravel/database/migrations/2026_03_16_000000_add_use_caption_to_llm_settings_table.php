<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('llm_settings', function (Blueprint $table) {
            $table->boolean('use_caption')->default(true)->after('tone');
        });
    }

    public function down(): void {
        Schema::table('llm_settings', function (Blueprint $table) {
            $table->dropColumn('use_caption');
        });
    }
};
