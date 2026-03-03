<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('instagram_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('instagram_login')->unique();
            $table->text('instagram_password');          // зашифровано
            $table->text('session_data')->nullable();    // зашифровано, JSON
            $table->string('proxy')->nullable();
            $table->string('full_name')->nullable();
            $table->text('profile_pic_url')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('instagram_accounts');
    }
};
