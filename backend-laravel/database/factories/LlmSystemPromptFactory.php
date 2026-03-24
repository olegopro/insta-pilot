<?php

declare(strict_types=1);

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\LlmSystemPrompt>
 */
class LlmSystemPromptFactory extends Factory {
    public function definition(): array {
        return [
            'key'             => fake()->unique()->slug(2),
            'title'           => fake()->words(3, true),
            'content'         => fake()->paragraph(),
            'default_content' => fake()->paragraph(),
        ];
    }
}
