<?php

declare(strict_types=1);

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\DeviceProfile>
 */
class DeviceProfileFactory extends Factory {
    public function definition(): array {
        return [
            'code'            => fake()->unique()->slug(2),
            'title'           => fake()->words(3, true),
            'device_settings' => [
                'app_version'      => '269.0.0.18.75',
                'android_version'  => 28,
                'android_release'  => '9.0',
                'manufacturer'     => 'Samsung',
                'model'            => 'SM-G965F',
            ],
            'user_agent'      => 'Instagram 269.0.0.18.75 Android (28/9.0; 480dpi; 1080x2154; samsung; SM-G965F; star2qltecs; qcom; en_US)',
            'is_active'       => true,
        ];
    }
}
