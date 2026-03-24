<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\LlmSetting;
use App\Repositories\LlmSettingsRepository;
use Tests\TestCase;

class LlmSettingsRepositoryTest extends TestCase {
    private LlmSettingsRepository $repository;

    protected function setUp(): void {
        parent::setUp();
        $this->repository = new LlmSettingsRepository();
    }

    public function test_get_all_returns_all_settings(): void {
        LlmSetting::factory()->openai()->create();
        LlmSetting::factory()->glm()->create();

        $result = $this->repository->getAll();

        $this->assertCount(2, $result);
    }

    public function test_find_by_id_returns_setting(): void {
        $setting = LlmSetting::factory()->create();

        $result = $this->repository->findById($setting->id);

        $this->assertNotNull($result);
        $this->assertEquals($setting->id, $result->id);
    }

    public function test_find_by_id_returns_null_for_nonexistent(): void {
        $result = $this->repository->findById(99999);

        $this->assertNull($result);
    }

    public function test_get_default_returns_default_setting(): void {
        LlmSetting::factory()->openai()->create(['is_default' => false]);
        $default = LlmSetting::factory()->glm()->default()->create();

        $result = $this->repository->getDefault();

        $this->assertNotNull($result);
        $this->assertEquals($default->id, $result->id);
    }

    public function test_get_default_returns_null_when_none_set(): void {
        LlmSetting::factory()->openai()->create(['is_default' => false]);
        LlmSetting::factory()->glm()->create(['is_default' => false]);

        $result = $this->repository->getDefault();

        $this->assertNull($result);
    }

    public function test_upsert_creates_new_setting(): void {
        $result = $this->repository->upsert('openai', [
            'api_key'    => 'sk-test-key',
            'model_name' => 'gpt-4o-mini',
        ]);

        $this->assertInstanceOf(LlmSetting::class, $result);
        $this->assertEquals('openai', $result->provider);
        $this->assertDatabaseHas('llm_settings', ['provider' => 'openai']);
    }

    public function test_upsert_updates_existing_setting(): void {
        LlmSetting::factory()->openai()->create(['model_name' => 'gpt-4o']);

        $result = $this->repository->upsert('openai', [
            'api_key'    => 'sk-new-key',
            'model_name' => 'gpt-4o-mini',
        ]);

        $this->assertEquals('gpt-4o-mini', $result->model_name);
        $this->assertCount(1, LlmSetting::where('provider', 'openai')->get());
    }

    public function test_set_default_switches_default(): void {
        $old = LlmSetting::factory()->openai()->default()->create();
        $new = LlmSetting::factory()->glm()->create(['is_default' => false]);

        $this->repository->setDefault($new->id);

        $this->assertDatabaseHas('llm_settings', ['id' => $old->id, 'is_default' => false]);
        $this->assertDatabaseHas('llm_settings', ['id' => $new->id, 'is_default' => true]);
    }

    public function test_delete_removes_setting(): void {
        $setting = LlmSetting::factory()->create();

        $this->repository->delete($setting->id);

        $this->assertDatabaseMissing('llm_settings', ['id' => $setting->id]);
    }
}
