<?php

declare(strict_types=1);

namespace Tests\Feature\LlmSettings;

use App\Models\LlmSetting;
use App\Models\LlmSystemPrompt;
use App\Models\User;
use App\Services\LlmServiceInterface;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class LlmSettingsTest extends TestCase {
    private User $admin;

    protected function setUp(): void {
        parent::setUp();
        $this->createRoles();

        /** @var User $admin */
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $this->admin = $admin;
    }

    private function makePrompt(string $content = 'Base prompt text', string $default = 'Base prompt text'): LlmSystemPrompt {
        return LlmSystemPrompt::create([
            'key'             => 'default_instagram_comment',
            'title'           => 'Test base prompt',
            'content'         => $content,
            'default_content' => $default,
        ]);
    }

    // --- index ---

    public function test_index_returns_settings(): void {
        LlmSetting::factory()->openai()->create();
        LlmSetting::factory()->glm()->create();

        $this->actingAs($this->admin)
            ->getJson('/api/llm-settings')
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonCount(2, 'data');
    }

    // --- show ---

    public function test_show_returns_setting_with_visible_api_key(): void {
        $setting = LlmSetting::factory()->openai()->create(['api_key' => 'sk-secret-key']);

        $this->actingAs($this->admin)
            ->getJson("/api/llm-settings/{$setting->id}")
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.api_key', 'sk-secret-key');
    }

    public function test_show_returns_404_for_nonexistent(): void {
        $this->actingAs($this->admin)
            ->getJson('/api/llm-settings/9999')
            ->assertStatus(404)
            ->assertJsonPath('success', false);
    }

    // --- store ---

    public function test_store_creates_setting(): void {
        $this->actingAs($this->admin)
            ->postJson('/api/llm-settings', [
                'provider'   => 'openai',
                'api_key'    => 'sk-test-key',
                'model_name' => 'gpt-4o-mini',
            ])
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('llm_settings', ['provider' => 'openai']);
    }

    public function test_store_encrypts_api_key_in_database(): void {
        $plainKey = 'sk-super-secret-key';

        $this->actingAs($this->admin)
            ->postJson('/api/llm-settings', [
                'provider'   => 'openai',
                'api_key'    => $plainKey,
                'model_name' => 'gpt-4o-mini',
            ])
            ->assertStatus(200);

        $raw = DB::table('llm_settings')->where('provider', 'openai')->value('api_key');

        $this->assertNotNull($raw);
        $this->assertNotEquals($plainKey, $raw);
    }

    public function test_store_requires_provider_api_key_model_name(): void {
        $this->actingAs($this->admin)
            ->postJson('/api/llm-settings', [])
            ->assertStatus(422);
    }

    // --- set default ---

    public function test_set_default_updates_default(): void {
        $openai = LlmSetting::factory()->openai()->default()->create();
        $glm    = LlmSetting::factory()->glm()->create();

        $this->actingAs($this->admin)
            ->patchJson("/api/llm-settings/{$glm->id}/default")
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('llm_settings', ['id' => $glm->id, 'is_default' => true]);
        $this->assertDatabaseHas('llm_settings', ['id' => $openai->id, 'is_default' => false]);
    }

    // --- destroy ---

    public function test_destroy_deletes_setting(): void {
        $setting = LlmSetting::factory()->openai()->create();

        $this->actingAs($this->admin)
            ->deleteJson("/api/llm-settings/{$setting->id}")
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('llm_settings', ['id' => $setting->id]);
    }

    // --- testConnection ---

    public function test_test_connection_success(): void {
        $this->mock(LlmServiceInterface::class)
            ->shouldReceive('testConnection')
            ->with('openai', 'sk-key', 'gpt-4o-mini')
            ->andReturn(true);

        $this->actingAs($this->admin)
            ->postJson('/api/llm-settings/test', [
                'provider'   => 'openai',
                'api_key'    => 'sk-key',
                'model_name' => 'gpt-4o-mini',
            ])
            ->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_test_connection_failure_returns_422(): void {
        $this->mock(LlmServiceInterface::class)
            ->shouldReceive('testConnection')
            ->andReturn(false);

        $this->actingAs($this->admin)
            ->postJson('/api/llm-settings/test', [
                'provider'   => 'glm',
                'api_key'    => 'sk-key',
                'model_name' => 'glm-4-flash',
            ])
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    // --- base prompt ---

    public function test_base_prompt_returns_content(): void {
        $this->makePrompt('Base text', 'Base text');

        $this->actingAs($this->admin)
            ->getJson('/api/llm-settings/base-prompt')
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.content', 'Base text')
            ->assertJsonPath('data.is_modified', false);
    }

    public function test_update_base_prompt(): void {
        $this->makePrompt('Original text', 'Original text');

        $this->actingAs($this->admin)
            ->putJson('/api/llm-settings/base-prompt', ['content' => 'Updated prompt'])
            ->assertStatus(200)
            ->assertJsonPath('data.content', 'Updated prompt')
            ->assertJsonPath('data.is_modified', true);
    }

    public function test_reset_base_prompt(): void {
        $this->makePrompt('Modified prompt', 'Default prompt');

        $this->actingAs($this->admin)
            ->postJson('/api/llm-settings/base-prompt/reset')
            ->assertStatus(200)
            ->assertJsonPath('data.content', 'Default prompt')
            ->assertJsonPath('data.is_modified', false);
    }

    // --- auth / ownership ---

    public function test_non_admin_gets_403(): void {
        /** @var User $user */
        $user = User::factory()->create();
        $user->assignRole('user');

        $this->actingAs($user)
            ->getJson('/api/llm-settings')
            ->assertStatus(403);
    }

    public function test_requires_auth(): void {
        $this->getJson('/api/llm-settings')
            ->assertStatus(401);
    }

    public function test_inactive_user_gets_403(): void {
        $inactive = User::factory()->inactive()->create();

        $this->actingAs($inactive)
            ->getJson('/api/llm-settings')
            ->assertStatus(403);
    }
}
