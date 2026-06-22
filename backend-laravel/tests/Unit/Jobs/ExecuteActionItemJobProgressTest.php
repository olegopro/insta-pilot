<?php

declare(strict_types=1);

namespace Tests\Unit\Jobs;

use App\Contracts\ActionPluginInterface;
use App\Events\AutomationTaskProgress;
use App\Jobs\ExecuteActionItemJob;
use App\Models\AutomationActionItem;
use App\Models\AutomationTask;
use App\Models\InstagramAccount;
use App\Models\ParseRun;
use App\Services\Automation\ActionPluginRegistryInterface;
use App\Services\Automation\RateLimitGuardServiceInterface;
use App\Services\Automation\WorkingHoursServiceInterface;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * Покрывает refreshTaskProgress внутри ExecuteActionItemJob:
 * терминальный статус (completed/failed) → current_action === null в событии.
 */
class ExecuteActionItemJobProgressTest extends TestCase {
    // ── helpers ───────────────────────────────────────────────────────────────

    private function makeTask(InstagramAccount $account, int $itemsTotal = 1): AutomationTask {
        $run = ParseRun::create([
            'user_id'              => $account->user_id,
            'instagram_account_id' => $account->id,
            'mode'                 => 'hashtag',
            'source_type'          => 'hashtag',
            'source_value'         => json_encode(['value' => 'test']),
            'filters_snapshot'     => json_encode([]),
            'target_limit'         => 100,
            'status'               => 'done',
        ]);

        return AutomationTask::create([
            'user_id'               => $account->user_id,
            'instagram_account_id'  => $account->id,
            'parse_run_id'          => $run->id,
            'mode'                  => 'auto',
            'action_type'           => 'like',
            'action_config'         => [],
            'target_count'          => $itemsTotal,
            'spread_seconds'        => 0,
            'jitter_seconds'        => 0,
            'respect_working_hours' => false,
            'status'                => 'running',
            'items_total'           => $itemsTotal,
            'items_done'            => 0,
            'items_failed'          => 0,
            'items_skipped'         => 0,
        ]);
    }

    private static int $mediaPkSeq = 8000;

    private function makeItem(AutomationTask $task, string $status = 'scheduled'): AutomationActionItem {
        return AutomationActionItem::create([
            'automation_task_id'   => $task->id,
            'instagram_account_id' => $task->instagram_account_id,
            'user_id'              => $task->user_id,
            'action_type'          => 'like',
            'target_user_pk'       => ++self::$mediaPkSeq,
            'media_pk'             => self::$mediaPkSeq,
            'payload'              => [],
            'status'               => $status,
            'run_at'               => now(),
        ]);
    }

    /** Мок-плагин, возвращающий success = true или false. */
    private function makePlugin(bool $success = true): ActionPluginInterface {
        $plugin = $this->createMock(ActionPluginInterface::class);
        $plugin->method('limitKey')->willReturn('like');
        $plugin->method('resolve')->willReturn([]);
        $plugin->method('execute')->willReturn(
            $success ? ['success' => true] : ['success' => false, 'error_code' => 'instagram_error', 'error' => 'err']
        );

        return $plugin;
    }

    private function makeRegistry(ActionPluginInterface $plugin): ActionPluginRegistryInterface {
        $registry = $this->createMock(ActionPluginRegistryInterface::class);
        $registry->method('get')->willReturn($plugin);

        return $registry;
    }

    private function makeRateLimit(bool $reserved = true): RateLimitGuardServiceInterface {
        $guard = $this->createMock(RateLimitGuardServiceInterface::class);
        $guard->method('reserve')->willReturn($reserved);

        return $guard;
    }

    private function makeWorkingHours(): WorkingHoursServiceInterface {
        return $this->createMock(WorkingHoursServiceInterface::class);
    }

    // ── DataProvider ──────────────────────────────────────────────────────────

    public static function terminalActionResultProvider(): array {
        return [
            'last item done → completed, current_action=null'    => [true,  'completed'],
            'last item failed → failed, current_action=null'     => [false, 'failed'],
        ];
    }

    // ── tests ─────────────────────────────────────────────────────────────────

    #[\PHPUnit\Framework\Attributes\DataProvider('terminalActionResultProvider')]
    public function test_terminal_event_has_null_current_action(bool $success, string $expectedStatus): void {
        Event::fake([AutomationTaskProgress::class]);

        $account  = InstagramAccount::factory()->create();
        $task     = $this->makeTask($account, itemsTotal: 1);
        $item     = $this->makeItem($task);

        $job = new ExecuteActionItemJob($item->id, 'like');
        $job->handle(
            $this->makeRegistry($this->makePlugin($success)),
            $this->makeRateLimit(),
            $this->makeWorkingHours()
        );

        Event::assertDispatched(
            AutomationTaskProgress::class,
            function (AutomationTaskProgress $event) use ($expectedStatus): bool {
                return $event->status === $expectedStatus
                    && $event->currentAction === null;
            }
        );
    }

    public function test_non_terminal_event_keeps_current_action(): void {
        Event::fake([AutomationTaskProgress::class]);

        // 2 items total, выполним первый → статус остаётся running, current_action=like.
        $account = InstagramAccount::factory()->create();
        $task    = $this->makeTask($account, itemsTotal: 2);
        // Второй item — заглушка (scheduled, не будет выполняться в этом job)
        $this->makeItem($task, 'scheduled');
        $item    = $this->makeItem($task);

        $job = new ExecuteActionItemJob($item->id, 'like');
        $job->handle(
            $this->makeRegistry($this->makePlugin(true)),
            $this->makeRateLimit(),
            $this->makeWorkingHours()
        );

        Event::assertDispatched(
            AutomationTaskProgress::class,
            function (AutomationTaskProgress $event): bool {
                return $event->status === 'running'
                    && $event->currentAction === 'like';
            }
        );
    }
}
