<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\InstagramAccount>
 */
class InstagramAccountFactory extends Factory {
    public function definition(): array {
        return [
            'user_id'            => User::factory(),
            'instagram_login'    => fake()->userName(),
            'instagram_password' => 'password',
            'session_data'       => null,
            'proxy'              => null,
            'device_profile_id'  => null,
            'device_model_name'  => null,
            'full_name'          => fake()->name(),
            'profile_pic_url'    => null,
            'is_active'          => true,
            'last_used_at'       => null,
        ];
    }
}
