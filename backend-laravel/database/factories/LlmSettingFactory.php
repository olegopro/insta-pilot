<?php

declare(strict_types=1);

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\LlmSetting>
 */
class LlmSettingFactory extends Factory {
    public function definition(): array {
        return [
            'provider'      => fake()->randomElement(['openai', 'glm']),
            'api_key'       => 'sk-test-' . fake()->lexify('????????????????????'),
            'model_name'    => 'gpt-4o-mini',
            'system_prompt' => null,
            'tone'          => 'friendly',
            'use_caption'   => true,
            'is_default'    => false,
        ];
    }

    public function default(): static {
        return $this->state(['is_default' => true]);
    }

    public function openai(): static {
        return $this->state(['provider' => 'openai', 'model_name' => 'gpt-4o-mini']);
    }

    public function glm(): static {
        return $this->state(['provider' => 'glm', 'model_name' => 'glm-4-flash']);
    }
}
