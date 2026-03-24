<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\InstagramAccount;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\AccountActivityLog>
 */
class AccountActivityLogFactory extends Factory {
    public function definition(): array {
        return [
            'instagram_account_id' => InstagramAccount::factory(),
            'user_id'              => User::factory(),
            'action'               => fake()->randomElement(['like', 'comment', 'login', 'feed', 'search']),
            'status'               => fake()->randomElement(['success', 'fail']),
            'http_code'            => fake()->randomElement([200, 401, 429, 500]),
            'endpoint'             => fake()->randomElement(['/media/like', '/media/comment', '/account/feed']),
            'request_payload'      => null,
            'response_summary'     => null,
            'error_message'        => null,
            'error_code'           => null,
            'duration_ms'          => fake()->numberBetween(100, 5000),
            'created_at'           => now(),
        ];
    }

    public function success(): static {
        return $this->state(['status' => 'success', 'http_code' => 200, 'error_message' => null]);
    }

    public function fail(string $errorMessage = 'Error', string $errorCode = 'error'): static {
        return $this->state([
            'status'        => 'fail',
            'http_code'     => 500,
            'error_message' => $errorMessage,
            'error_code'    => $errorCode,
        ]);
    }
}
