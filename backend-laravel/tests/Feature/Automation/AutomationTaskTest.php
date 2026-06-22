<?php

declare(strict_types=1);

namespace Tests\Feature\Automation;

use App\Models\AutomationTask;
use App\Models\InstagramAccount;
use App\Models\ParsedTarget;
use App\Models\ParseRun;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AutomationTaskTest extends TestCase {
    private User $user;
    private InstagramAccount $account;

    protected function setUp(): void {
        parent::setUp();

        $this->user    = User::factory()->create();
        $this->account = InstagramAccount::factory()->create(['user_id' => $this->user->id]);
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private function makeParseRun(): ParseRun {
        return ParseRun::create([
            'user_id'              => $this->user->id,
            'instagram_account_id' => $this->account->id,
            'mode'                 => 'semi_auto',
            'source_type'          => 'hashtag',
            'source_value'         => ['value' => 'test'],
            'filters_snapshot'     => [],
            'target_limit'         => 100,
            'status'               => 'done'
        ]);
    }

    private function makeTask(?int $parseRunId): AutomationTask {
        return AutomationTask::create([
            'user_id'               => $this->user->id,
            'instagram_account_id'  => $this->account->id,
            'parse_run_id'          => $parseRunId,
            'mode'                  => 'semi_auto',
            'action_type'           => 'comment',
            'action_config'         => [],
            'target_count'          => 10,
            'spread_seconds'        => 3600,
            'jitter_seconds'        => 0,
            'respect_working_hours' => false,
            'status'                => 'draft'
        ]);
    }

    private function makeTarget(int $parseRunId, string $status): ParsedTarget {
        static $seq = 1;
        $seq++;

        return ParsedTarget::create([
            'parse_run_id'     => $parseRunId,
            'user_id'          => $this->user->id,
            'target_user_pk'   => $seq,
            'target_username'  => 'user_' . $seq,
            'media_pk'         => 1000 + $seq,
            'metrics_snapshot' => [],
            'status'           => $status
        ]);
    }

    // ── index ───────────────────────────────────────────────────────────────────

    public function test_index_returns_collected_targets_count_for_draft(): void {
        $run  = $this->makeParseRun();
        $task = $this->makeTask($run->id);
        $this->makeTarget($run->id, 'kept');
        $this->makeTarget($run->id, 'kept');
        $this->makeTarget($run->id, 'trashed'); // не считается

        $this->actingAs($this->user)
            ->getJson('/api/automation')
            ->assertStatus(200)
            ->assertJsonPath('data.0.id', $task->id)
            ->assertJsonPath('data.0.collected_targets_count', 2);
    }

    public function test_index_returns_zero_when_task_has_no_parse_run(): void {
        $this->makeTask(null);

        $this->actingAs($this->user)
            ->getJson('/api/automation')
            ->assertStatus(200)
            ->assertJsonPath('data.0.collected_targets_count', 0);
    }

    public function test_index_has_no_n_plus_one_for_collected_targets(): void {
        // Три черновика с целями: счётчик должен быть коррелированным подзапросом
        // внутри одного SELECT, а не отдельным запросом на каждую задачу.
        foreach (range(1, 3) as $ignored) {
            $run = $this->makeParseRun();
            $this->makeTask($run->id);
            $this->makeTarget($run->id, 'kept');
        }

        $queries = [];
        DB::listen(function ($query) use (&$queries) {
            (str_contains($query->sql, 'automation_tasks') || str_contains($query->sql, 'parsed_targets'))
                && $queries[] = $query->sql;
        });

        $this->actingAs($this->user)
            ->getJson('/api/automation')
            ->assertStatus(200)
            ->assertJsonCount(3, 'data');

        $this->assertCount(1, $queries);
    }

    // ── show ──────────────────────────────────────────────────────────────────

    public function test_show_returns_collected_targets_count_for_draft(): void {
        $run  = $this->makeParseRun();
        $task = $this->makeTask($run->id);
        $this->makeTarget($run->id, 'kept');
        $this->makeTarget($run->id, 'kept');
        $this->makeTarget($run->id, 'kept');

        $this->actingAs($this->user)
            ->getJson("/api/automation/{$task->id}")
            ->assertStatus(200)
            ->assertJsonPath('data.collected_targets_count', 3);
    }

    public function test_show_returns_zero_when_task_has_no_parse_run(): void {
        $task = $this->makeTask(null);

        $this->actingAs($this->user)
            ->getJson("/api/automation/{$task->id}")
            ->assertStatus(200)
            ->assertJsonPath('data.collected_targets_count', 0);
    }
}
