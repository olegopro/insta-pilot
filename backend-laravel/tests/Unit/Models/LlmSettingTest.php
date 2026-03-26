<?php

declare(strict_types=1);

namespace Tests\Unit\Models;

use App\Models\LlmSetting;
use Tests\TestCase;

class LlmSettingTest extends TestCase {
    public function test_api_key_is_encrypted_on_save(): void {
        $setting = LlmSetting::factory()->openai()->create(['api_key' => 'sk-test-plainkey']);

        $raw = \DB::table('llm_settings')->where('id', $setting->id)->value('api_key');

        $this->assertNotEquals('sk-test-plainkey', $raw);
        $this->assertEquals('sk-test-plainkey', $setting->api_key);
    }

    public function test_boolean_casts(): void {
        $setting = LlmSetting::factory()->create([
            'use_caption' => true,
            'is_default'  => false,
        ]);

        $fresh = LlmSetting::find($setting->id);

        $this->assertTrue($fresh->use_caption);
        $this->assertFalse($fresh->is_default);
    }

    public function test_api_key_hidden_in_json(): void {
        $setting = LlmSetting::factory()->openai()->create(['api_key' => 'sk-secret']);

        $json = json_decode($setting->toJson(), true);

        $this->assertArrayNotHasKey('api_key', $json);
    }

    public function test_fillable_contains_required_fields(): void {
        $setting = new LlmSetting();
        $fillable = $setting->getFillable();

        $fields = [
            'provider',
            'api_key',
            'model_name',
            'tone',
            'use_caption',
            'is_default'
        ];
        foreach ($fields as $field) {
            $this->assertContains($field, $fillable);
        }
    }
}
