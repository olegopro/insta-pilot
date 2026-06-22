<?php

declare(strict_types=1);

namespace Tests\Unit\Services;

use App\Models\AutomationActionItem;
use App\Models\AutomationTask;
use App\Models\InstagramAccount;
use App\Models\ParsedTarget;
use App\Models\User;
use App\Services\Automation\ActionSchedulerService;
use App\Services\Automation\WorkingHoursServiceInterface;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActionSchedulerServiceTest extends TestCase {
    private ActionSchedulerService $service;

    protected function setUp(): void {
        parent::setUp();
        $workingHours = $this->createMock(WorkingHoursServiceInterface::class);
        $workingHours->method('nextOpenSlot')->willReturnArgument(1);
        $this->service = new ActionSchedulerService($workingHours);
    }

    protected function tearDown(): void {
        // Снимаем заморозку времени, чтобы не протекала в соседние тесты
        Carbon::setTestNow();
        parent::tearDown();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private function makeTask(InstagramAccount $account, int $parseRunId, int $targetCount = 10): AutomationTask {
        return AutomationTask::create([
            'user_id'               => $account->user_id,
            'instagram_account_id'  => $account->id,
            'parse_run_id'          => $parseRunId,
            'mode'                  => 'auto',
            'action_type'           => 'like',
            'action_config'         => [],
            'target_count'          => $targetCount,
            'spread_seconds'        => 3600,
            'jitter_seconds'        => 0,
            'respect_working_hours' => false,
            'status'                => 'draft',
        ]);
    }

    private function makeParseRun(InstagramAccount $account): \App\Models\ParseRun {
        return \App\Models\ParseRun::create([
            'user_id'              => $account->user_id,
            'instagram_account_id' => $account->id,
            'mode'                 => 'hashtag',
            'source_type'          => 'hashtag',
            'source_value'         => json_encode(['value' => 'test']),
            'filters_snapshot'     => json_encode([]),
            'target_limit'         => 100,
            'status'               => 'done',
        ]);
    }

    private function makeTarget(int $parseRunId, int $userId, int $mediaPk): ParsedTarget {
        static $seq = 1;
        return ParsedTarget::create([
            'parse_run_id'      => $parseRunId,
            'user_id'           => $userId,
            'target_user_pk'    => $seq++,
            'target_username'   => 'user_' . $seq,
            'media_pk'          => $mediaPk,
            'metrics_snapshot'  => json_encode([]),
            'status'            => 'kept',
        ]);
    }

    private function makeExistingItem(AutomationTask $otherTask, int $mediaPk): void {
        AutomationActionItem::create([
            'automation_task_id'   => $otherTask->id,
            'instagram_account_id' => $otherTask->instagram_account_id,
            'user_id'              => $otherTask->user_id,
            'action_type'          => 'like',
            'target_user_pk'       => 999,
            'media_pk'             => $mediaPk,
            'payload'              => json_encode([]),
            'status'               => 'done',
            'run_at'               => now(),
        ]);
    }

    // ── tests ─────────────────────────────────────────────────────────────────

    public function test_no_exception_when_media_pk_collides_with_existing_item(): void {
        $account  = InstagramAccount::factory()->create();
        $run      = $this->makeParseRun($account);
        $this->makeTarget($run->id, $account->user_id, 1001);
        $task     = $this->makeTask($account, $run->id, 1);
        $oldTask  = $this->makeTask($account, $run->id, 1);
        $this->makeExistingItem($oldTask, 1001);

        // Must not throw PDOException 23505
        $this->service->scheduleTask($task);

        $this->assertTrue(true); // reached without exception
    }

    public static function partialDedupeProvider(): array {
        return [
            'one duplicate one fresh' => [1, 1],
            'two duplicates one fresh' => [2, 1],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('partialDedupeProvider')]
    public function test_only_non_duplicate_targets_are_inserted(int $dupeCount, int $freshCount): void {
        $account = InstagramAccount::factory()->create();
        $run     = $this->makeParseRun($account);
        $oldTask = $this->makeTask($account, $run->id, 100);

        $dupePks = range(2001, 2000 + $dupeCount);
        foreach ($dupePks as $pk) {
            $this->makeTarget($run->id, $account->user_id, $pk);
            $this->makeExistingItem($oldTask, $pk);
        }

        $freshPks = range(3001, 3000 + $freshCount);
        foreach ($freshPks as $pk) {
            $this->makeTarget($run->id, $account->user_id, $pk);
        }

        $task = $this->makeTask($account, $run->id, $dupeCount + $freshCount);
        $this->service->scheduleTask($task);

        $task->refresh();
        // Only fresh items inserted for this task
        $this->assertSame($freshCount, AutomationActionItem::where('automation_task_id', $task->id)->count());
    }

    public function test_items_total_equals_actually_inserted_count(): void {
        $account = InstagramAccount::factory()->create();
        $run     = $this->makeParseRun($account);
        $oldTask = $this->makeTask($account, $run->id, 100);

        $this->makeTarget($run->id, $account->user_id, 4001); // dupe
        $this->makeExistingItem($oldTask, 4001);
        $this->makeTarget($run->id, $account->user_id, 4002); // fresh
        $this->makeTarget($run->id, $account->user_id, 4003); // fresh

        $task = $this->makeTask($account, $run->id, 3);
        $this->service->scheduleTask($task);

        $task->refresh();
        $this->assertSame(2, $task->items_total);
    }

    public function test_all_duplicates_transitions_task_to_completed(): void {
        $account = InstagramAccount::factory()->create();
        $run     = $this->makeParseRun($account);
        $oldTask = $this->makeTask($account, $run->id, 100);

        foreach ([5001, 5002] as $pk) {
            $this->makeTarget($run->id, $account->user_id, $pk);
            $this->makeExistingItem($oldTask, $pk);
        }

        $task = $this->makeTask($account, $run->id, 2);
        $this->service->scheduleTask($task);

        $task->refresh();
        $this->assertSame('completed', $task->status);
        $this->assertNotNull($task->finished_at);
        $this->assertSame(0, $task->items_total);
    }

    // ── offsets-путь (buildItemsWithOffsets) ────────────────────────────────────

    public function test_offsets_path_sets_run_at_to_t0_plus_each_target_offset(): void {
        // Замораживаем время: t0 берётся из Carbon::now() внутри scheduleTask
        $t0 = Carbon::create(2026, 6, 22, 12, 0, 0);
        Carbon::setTestNow($t0);

        $account = InstagramAccount::factory()->create();
        $run     = $this->makeParseRun($account);
        $a = $this->makeTarget($run->id, $account->user_id, 8001);
        $b = $this->makeTarget($run->id, $account->user_id, 8002);
        $c = $this->makeTarget($run->id, $account->user_id, 8003);

        // Ключ карты — parsed_target_id; значения вне порядка и разнесены ≥60с (зазор не вмешивается)
        $offsets = [
            $a->id => 600,
            $b->id => 0,
            $c->id => 300
        ];

        $task = $this->makeTask($account, $run->id, 3);
        $this->service->scheduleTask($task, $offsets);

        $items = AutomationActionItem::where('automation_task_id', $task->id)
            ->get()
            ->keyBy('parsed_target_id');

        // run_at каждой цели = t0 + её собственный offset (привязка по parsed_target_id, не по индексу)
        $this->assertSame(
            $t0->copy()->addSeconds(600)->format('Y-m-d H:i:s'),
            $items[$a->id]->run_at->format('Y-m-d H:i:s')
        );
        $this->assertSame(
            $t0->copy()->format('Y-m-d H:i:s'),
            $items[$b->id]->run_at->format('Y-m-d H:i:s')
        );
        $this->assertSame(
            $t0->copy()->addSeconds(300)->format('Y-m-d H:i:s'),
            $items[$c->id]->run_at->format('Y-m-d H:i:s')
        );
    }

    public function test_offsets_path_enforces_min_gap_when_offsets_too_close(): void {
        $t0 = Carbon::create(2026, 6, 22, 12, 0, 0);
        Carbon::setTestNow($t0);

        $account = InstagramAccount::factory()->create();
        $run     = $this->makeParseRun($account);
        $a = $this->makeTarget($run->id, $account->user_id, 8101);
        $b = $this->makeTarget($run->id, $account->user_id, 8102);
        $c = $this->makeTarget($run->id, $account->user_id, 8103);

        // Смещения ближе 60с — планировщик обязан раздвинуть до MIN_GAP_SECONDS=60
        $offsets = [
            $a->id => 0,
            $b->id => 10,
            $c->id => 20
        ];

        $task = $this->makeTask($account, $run->id, 3);
        $this->service->scheduleTask($task, $offsets);

        $items = AutomationActionItem::where('automation_task_id', $task->id)
            ->get()
            ->keyBy('parsed_target_id');

        // Соседние run_at раздвинуты ровно на 60с: t0, t0+60, t0+120
        $this->assertSame(
            $t0->copy()->format('Y-m-d H:i:s'),
            $items[$a->id]->run_at->format('Y-m-d H:i:s')
        );
        $this->assertSame(
            $t0->copy()->addSeconds(60)->format('Y-m-d H:i:s'),
            $items[$b->id]->run_at->format('Y-m-d H:i:s')
        );
        $this->assertSame(
            $t0->copy()->addSeconds(120)->format('Y-m-d H:i:s'),
            $items[$c->id]->run_at->format('Y-m-d H:i:s')
        );

        // Фактический зазор между соседями по run_at ≥60с
        $sorted = $items->sortBy('run_at')->values();
        $this->assertGreaterThanOrEqual(60, abs($sorted[0]->run_at->diffInSeconds($sorted[1]->run_at)));
        $this->assertGreaterThanOrEqual(60, abs($sorted[1]->run_at->diffInSeconds($sorted[2]->run_at)));
    }

    public function test_offsets_path_ignores_jitter_seconds(): void {
        $t0 = Carbon::create(2026, 6, 22, 12, 0, 0);
        Carbon::setTestNow($t0);

        $account = InstagramAccount::factory()->create();
        $run     = $this->makeParseRun($account);
        $a = $this->makeTarget($run->id, $account->user_id, 8201);
        $b = $this->makeTarget($run->id, $account->user_id, 8202);

        // Большой jitter: even-путь дал бы случайный сдвиг, offsets-путь — детерминирован
        $task = $this->makeTask($account, $run->id, 2);
        $task->update(['jitter_seconds' => 600]);

        // Смещения разнесены ≥60с, чтобы исключить влияние зазора и проверить только jitter
        $offsets = [
            $a->id => 0,
            $b->id => 300
        ];
        $this->service->scheduleTask($task, $offsets);

        $items = AutomationActionItem::where('automation_task_id', $task->id)
            ->get()
            ->keyBy('parsed_target_id');

        // run_at строго равен t0 + offset — никакого случайного дрейфа от jitter
        $this->assertSame(
            $t0->copy()->format('Y-m-d H:i:s'),
            $items[$a->id]->run_at->format('Y-m-d H:i:s')
        );
        $this->assertSame(
            $t0->copy()->addSeconds(300)->format('Y-m-d H:i:s'),
            $items[$b->id]->run_at->format('Y-m-d H:i:s')
        );
    }

    public function test_offsets_path_skips_duplicate_media_pk_and_keeps_offset_by_target_id(): void {
        $t0 = Carbon::create(2026, 6, 22, 12, 0, 0);
        Carbon::setTestNow($t0);

        $account = InstagramAccount::factory()->create();
        $run     = $this->makeParseRun($account);
        $oldTask = $this->makeTask($account, $run->id, 100);

        // media_pk дубля уже занят item-ом того же аккаунта → должен отсеяться до планирования
        $dupe  = $this->makeTarget($run->id, $account->user_id, 8301);
        $this->makeExistingItem($oldTask, 8301);
        $fresh = $this->makeTarget($run->id, $account->user_id, 8302);

        $offsets = [
            $dupe->id  => 0,
            $fresh->id => 300
        ];
        $task = $this->makeTask($account, $run->id, 2);
        $this->service->scheduleTask($task, $offsets);

        $task->refresh();
        $items = AutomationActionItem::where('automation_task_id', $task->id)->get();

        // Вставлена только свежая цель; items_total = числу реально вставленных
        $this->assertSame(1, $items->count());
        $this->assertSame(1, $task->items_total);
        $this->assertSame($fresh->id, $items->first()->parsed_target_id);

        // offset остаётся привязан к parsed_target_id даже после выпадения дубля
        $this->assertSame(
            $t0->copy()->addSeconds(300)->format('Y-m-d H:i:s'),
            $items->first()->run_at->format('Y-m-d H:i:s')
        );
    }
}
