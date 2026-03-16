<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class () extends Migration {
    public function up(): void {
        Schema::table('instagram_accounts', function (Blueprint $table) {
            $table->foreignId('device_profile_id')->nullable()->after('proxy')->constrained('device_profiles')->nullOnDelete();
            $table->string('device_model_name')->nullable()->after('device_profile_id');
        });
    }

    public function down(): void {
        Schema::table('instagram_accounts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('device_profile_id');
            $table->dropColumn('device_model_name');
        });
    }
};
