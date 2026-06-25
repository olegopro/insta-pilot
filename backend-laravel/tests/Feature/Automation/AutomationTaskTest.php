<?php

declare(strict_types=1);

namespace Tests\Feature\Automation;

use App\Jobs\ParseTargetsJob;
use App\Models\AutomationTask;
use App\Models\InstagramAccount;
use App\Models\ParsedTarget;
use App\Models\ParseRun;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
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

    private function makeParseRun(string $status = 'done', ?string $error = null): ParseRun {
        return ParseRun::create([
            'user_id'              => $this->user->id,
            'instagram_account_id' => $this->account->id,
            'mode'                 => 'semi_auto',
            'source_type'          => 'hashtag',
            'source_value'         => ['value' => 'test'],
            'filters_snapshot'     => [],
            'target_limit'         => 100,
            'status'               => $status,
            'error_message'        => $error
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

    // ── parse phase (parse_status / parse_error) ────────────────────────────────

    /**
     * @return array<string, array{0: ?string, 1: ?string, 2: ?string, 3: ?string}>
     */
    public static function parsePhaseProvider(): array {
        return [
            'pending → parsing'        => ['pending',   null,             'parsing', null],
            'running → parsing'        => ['running',   null,             'parsing', null],
            'completed → done'         => ['completed', null,             'done',    null],
            'failed → failed + error'  => ['failed',    'Сессия слетела', 'failed',  'Сессия слетела'],
            'no parse_run → null/null' => [null,        null,             null,      null]
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('parsePhaseProvider')]
    public function test_index_exposes_parse_phase_fields(?string $runStatus, ?string $runError, ?string $expectedStatus, ?string $expectedError): void {
        $runId = $runStatus === null ? null : $this->makeParseRun($runStatus, $runError)->id;
        $task  = $this->makeTask($runId);

        $this->actingAs($this->user)
            ->getJson('/api/automation')
            ->assertStatus(200)
            ->assertJsonPath('data.0.id', $task->id)
            ->assertJsonPath('data.0.parse_status', $expectedStatus)
            ->assertJsonPath('data.0.parse_error', $expectedError);
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('parsePhaseProvider')]
    public function test_show_exposes_parse_phase_fields(?string $runStatus, ?string $runError, ?string $expectedStatus, ?string $expectedError): void {
        $runId = $runStatus === null ? null : $this->makeParseRun($runStatus, $runError)->id;
        $task  = $this->makeTask($runId);

        $this->actingAs($this->user)
            ->getJson("/api/automation/{$task->id}")
            ->assertStatus(200)
            ->assertJsonPath('data.parse_status', $expectedStatus)
            ->assertJsonPath('data.parse_error', $expectedError);
    }

    // ── clone ───────────────────────────────────────────────────────────────────

    public function test_clone_creates_new_draft_task_with_same_params(): void {
        $run  = $this->makeParseRun('completed');
        $task = $this->makeTask($run->id);

        $response = $this->actingAs($this->user)
            ->postJson("/api/automation/{$task->id}/clone")
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Задача склонирована');

        $newTaskId = $response->json('data.id');
        $this->assertNotSame($task->id, $newTaskId);

        $newTask = AutomationTask::find($newTaskId);
        $this->assertSame('draft', $newTask->status);
        $this->assertSame($task->mode, $newTask->mode);
        $this->assertSame($task->action_type, $newTask->action_type);
        $this->assertSame($task->target_count, $newTask->target_count);
        $this->assertNotSame($task->parse_run_id, $newTask->parse_run_id);

        $newRun = ParseRun::find($newTask->parse_run_id);
        $this->assertSame('pending', $newRun->status);
        $this->assertSame($run->source_type, $newRun->source_type);
        $this->assertSame($run->source_value, $newRun->source_value);
        $this->assertSame($run->filters_snapshot, $newRun->filters_snapshot);
        $this->assertSame($run->target_limit, $newRun->target_limit);
    }

    public function test_clone_does_not_copy_parsed_targets(): void {
        $run  = $this->makeParseRun('completed');
        $task = $this->makeTask($run->id);
        $this->makeTarget($run->id, 'kept');
        $this->makeTarget($run->id, 'kept');

        $response = $this->actingAs($this->user)
            ->postJson("/api/automation/{$task->id}/clone")
            ->assertStatus(200);

        $newTask = AutomationTask::find($response->json('data.id'));

        $this->assertSame(0, ParsedTarget::where('parse_run_id', $newTask->parse_run_id)->count());
        // Цели исходного парс-рана остаются нетронутыми.
        $this->assertSame(2, ParsedTarget::where('parse_run_id', $run->id)->count());
    }

    public function test_clone_returns_404_for_foreign_task(): void {
        $other    = User::factory()->create();
        $otherRun = ParseRun::create([
            'user_id'              => $other->id,
            'instagram_account_id' => $this->account->id,
            'mode'                 => 'semi_auto',
            'source_type'          => 'hashtag',
            'source_value'         => ['value' => 'x'],
            'filters_snapshot'     => [],
            'target_limit'         => 10,
            'status'               => 'completed'
        ]);
        $otherTask = AutomationTask::create([
            'user_id'              => $other->id,
            'instagram_account_id' => $this->account->id,
            'parse_run_id'         => $otherRun->id,
            'mode'                 => 'semi_auto',
            'action_type'          => 'comment',
            'action_config'        => [],
            'target_count'         => 10,
            'status'               => 'draft'
        ]);

        $this->actingAs($this->user)
            ->postJson("/api/automation/{$otherTask->id}/clone")
            ->assertStatus(404);
    }

    // ── parse-targets (idempotent retry) ──────────────────────────────────────────

    public function test_retry_parse_resets_run_and_dispatches_for_draft(): void {
        Queue::fake();

        $run = $this->makeParseRun('failed', 'Сессия слетела');
        $run->forceFill([
            'scanned_count'   => 42,
            'collected_count' => 7
        ])->save();
        $task = $this->makeTask($run->id);
        $this->makeTarget($run->id, 'kept');
        $this->makeTarget($run->id, 'trashed');

        $this->actingAs($this->user)
            ->postJson("/api/automation/{$task->id}/parse-targets")
            ->assertStatus(200)
            ->assertJsonPath('data.parse_run_id', $run->id)
            ->assertJsonPath('message', 'Парсинг целей запущен');

        $run->refresh();
        $this->assertSame('pending', $run->status);
        $this->assertNull($run->error_message);
        $this->assertSame(0, $run->scanned_count);
        $this->assertSame(0, $run->collected_count);
        $this->assertSame(0, ParsedTarget::where('parse_run_id', $run->id)->count());

        Queue::assertPushed(ParseTargetsJob::class, function (ParseTargetsJob $job) use ($run) {
            return $job->parseRunId === $run->id;
        });
    }

    public function test_retry_parse_returns_422_for_running_task(): void {
        Queue::fake();

        $run  = $this->makeParseRun('completed');
        $task = $this->makeTask($run->id);
        $task->forceFill(['status' => 'running'])->save();

        $this->actingAs($this->user)
            ->postJson("/api/automation/{$task->id}/parse-targets")
            ->assertStatus(422)
            ->assertJsonPath('success', false);

        Queue::assertNothingPushed();
    }
}
