<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('parsed_targets', function (Blueprint $table) {
            $table->text('media_thumbnail_url')->nullable()->after('media_id');
        });
    }

    public function down(): void {
        Schema::table('parsed_targets', function (Blueprint $table) {
            $table->dropColumn('media_thumbnail_url');
        });
    }
};
