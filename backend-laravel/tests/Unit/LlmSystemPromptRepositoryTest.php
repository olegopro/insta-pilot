<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\LlmSystemPrompt;
use App\Repositories\LlmSystemPromptRepository;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Tests\TestCase;

class LlmSystemPromptRepositoryTest extends TestCase {
    private LlmSystemPromptRepository $repository;

    protected function setUp(): void {
        parent::setUp();
        $this->repository = new LlmSystemPromptRepository();
    }

    public function test_find_by_key_returns_prompt(): void {
        $prompt = LlmSystemPrompt::factory()->create(['key' => 'base-prompt']);

        $result = $this->repository->findByKey('base-prompt');

        $this->assertNotNull($result);
        $this->assertEquals($prompt->id, $result->id);
    }

    public function test_find_by_key_returns_null_for_unknown_key(): void {
        $result = $this->repository->findByKey('no-such-key');

        $this->assertNull($result);
    }

    public function test_update_by_key_updates_content(): void {
        LlmSystemPrompt::factory()->create(['key' => 'base-prompt', 'content' => 'old content']);

        $result = $this->repository->updateByKey('base-prompt', 'new content');

        $this->assertEquals('new content', $result->content);
        $this->assertDatabaseHas('llm_system_prompts', ['key' => 'base-prompt', 'content' => 'new content']);
    }

    public function test_update_by_key_throws_for_nonexistent_key(): void {
        $this->expectException(ModelNotFoundException::class);

        $this->repository->updateByKey('no-such-key', 'content');
    }
}
