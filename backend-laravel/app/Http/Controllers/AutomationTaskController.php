<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Jobs\ParseTargetsJob;
use App\Jobs\ScheduleActionItemsJob;
use App\Repositories\AutomationTaskRepositoryInterface;
use App\Repositories\InstagramAccountRepositoryInterface;
use App\Repositories\ParsedTargetRepositoryInterface;
use App\Repositories\ParseRunRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class AutomationTaskController extends Controller {
    public function __construct(
        private readonly AutomationTaskRepositoryInterface $taskRepository,
        private readonly InstagramAccountRepositoryInterface $accountRepository,
        private readonly ParseRunRepositoryInterface $parseRunRepository,
        private readonly ParsedTargetRepositoryInterface $parsedTargetRepository
    ) {}

    public function store(Request $request): JsonResponse {
        $validated = $request->validate([
            'instagram_account_id' => 'required|integer',
            'mode'                 => 'required|string|in:semi_auto,full_auto',
            'action_type'          => 'required|string|in:comment,like,follow,unfollow',
            'source'               => 'required|array',
            'source.type'          => 'required|string|in:hashtag,location,hashtag_location,hashtag_list,my_following',
            'source.value'         => 'present|array',
            'filters'              => 'nullable|array',
            'target_count'         => 'required|integer|min:1|max:200',
            'action_config'        => 'nullable|array'
        ]);

        $userId  = $request->user()->id;
        $account = $this->accountRepository->findByIdAndUser((int) $validated['instagram_account_id'], $userId);

        if (!$account) {
            return $this->accountNotFound();
        }

        $filters = $validated['filters'] ?? [];

        // parse_run + task создаём атомарно: падение создания task не должно
        // оставить orphan parse_run.
        return DB::transaction(function () use ($userId, $account, $validated, $filters): JsonResponse {
            $parseRun = $this->parseRunRepository->create([
                'user_id'              => $userId,
                'instagram_account_id' => $account->id,
                'mode'                 => $validated['mode'],
                'source_type'          => $validated['source']['type'],
                'source_value'         => $validated['source']['value'],
                'filters_snapshot'     => $filters,
                'target_limit'         => (int) $validated['target_count'],
                'status'               => 'pending'
            ]);

            $task = $this->taskRepository->create([
                'user_id'              => $userId,
                'instagram_account_id' => $account->id,
                'parse_run_id'         => $parseRun->id,
                'mode'                 => $validated['mode'],
                'action_type'          => $validated['action_type'],
                'action_config'        => $validated['action_config'] ?? [],
                'target_count'         => (int) $validated['target_count'],
                'status'               => 'draft'
            ]);

            return response()->json([
                'success' => true,
                'data'    => $task,
                'message' => 'Задача создана'
            ]);
        });
    }

    public function parseTargets(int $id, Request $request): JsonResponse {
        $task = $this->taskRepository->findByIdAndUser($id, $request->user()->id);

        if (!$task) {
            return $this->taskNotFound();
        }

        if ($task->parse_run_id === null) {
            return response()->json([
                'success' => false,
                'error'   => 'У задачи нет связанного парс-рана'
            ], 422);
        }

        // Перепарсить можно только черновик: запущенную/завершённую задачу
        // пересобирать нельзя (её цели уже могли быть распланированы в действия).
        if ($task->status !== 'draft') {
            return response()->json([
                'success' => false,
                'error'   => 'Перепарсить цели можно только для задачи-черновика'
            ], 422);
        }

        $parseRunId = (int) $task->parse_run_id;

        // Идемпотентный перезапуск: сбрасываем статус и счётчики парс-рана и удаляем
        // ранее собранные цели — повтор/клон соберёт их заново с чистого листа.
        $this->parseRunRepository->reset($parseRunId);
        $this->parsedTargetRepository->deleteByParseRun($parseRunId);

        ParseTargetsJob::dispatch($parseRunId);

        return response()->json([
            'success' => true,
            'data'    => ['parse_run_id' => $parseRunId],
            'message' => 'Парсинг целей запущен'
        ]);
    }

    public function clone(int $id, Request $request): JsonResponse {
        $userId = $request->user()->id;
        $task   = $this->taskRepository->findByIdAndUser($id, $userId);

        if (!$task) {
            return $this->taskNotFound();
        }

        if ($task->parse_run_id === null) {
            return response()->json([
                'success' => false,
                'error'   => 'У задачи нет связанного парс-рана'
            ], 422);
        }

        $sourceRun = $this->parseRunRepository->findById((int) $task->parse_run_id);

        if (!$sourceRun) {
            return response()->json([
                'success' => false,
                'error'   => 'Связанный парс-ран не найден'
            ], 422);
        }

        // Новый парс-ран — копия источника, но status='pending' и без целей:
        // клон собирает собственный набор целей заново. parse_run + newTask
        // создаём атомарно, чтобы не оставить orphan parse_run.
        return DB::transaction(function () use ($userId, $task, $sourceRun): JsonResponse {
            $parseRun = $this->parseRunRepository->create([
                'user_id'              => $userId,
                'instagram_account_id' => $sourceRun->instagram_account_id,
                'mode'                 => $sourceRun->mode,
                'source_type'          => $sourceRun->source_type,
                'source_value'         => $sourceRun->source_value,
                'filters_snapshot'     => $sourceRun->filters_snapshot,
                'target_limit'         => $sourceRun->target_limit,
                'status'               => 'pending'
            ]);

            $newTask = $this->taskRepository->create([
                'user_id'              => $userId,
                'instagram_account_id' => $task->instagram_account_id,
                'parse_run_id'         => $parseRun->id,
                'mode'                 => $task->mode,
                'action_type'          => $task->action_type,
                'action_config'        => $task->action_config ?? [],
                'target_count'         => $task->target_count,
                'status'               => 'draft'
            ]);

            return response()->json([
                'success' => true,
                'data'    => $newTask,
                'message' => 'Задача склонирована'
            ]);
        });
    }

    public function targets(int $id, Request $request): JsonResponse {
        $task = $this->taskRepository->findByIdAndUser($id, $request->user()->id);

        if (!$task) {
            return $this->taskNotFound();
        }

        if ($task->parse_run_id === null) {
            return response()->json([
                'success' => true,
                'data'    => [],
                'message' => 'OK'
            ]);
        }

        $status  = $request->query('status');
        $targets = $this->parsedTargetRepository->getByParseRun(
            (int) $task->parse_run_id,
            is_string($status) && $status !== '' ? $status : null
        );

        return response()->json([
            'success' => true,
            'data'    => $targets,
            'message' => 'OK'
        ]);
    }

    public function excludeTarget(int $id, int $targetId, Request $request): JsonResponse {
        return $this->changeTargetStatus($id, $targetId, 'trashed', $request);
    }

    public function restoreTarget(int $id, int $targetId, Request $request): JsonResponse {
        return $this->changeTargetStatus($id, $targetId, 'kept', $request);
    }

    public function start(int $id, Request $request): JsonResponse {
        $task = $this->taskRepository->findByIdAndUser($id, $request->user()->id);

        if (!$task) {
            return $this->taskNotFound();
        }

        if ($task->actionItems()->exists()) {
            return response()->json([
                'success' => true,
                'data'    => ['task_id' => $id],
                'message' => 'Задача уже запущена'
            ]);
        }

        // Опциональное тело: ручное распределение во времени. Пусто/нет — равномерно
        // из spread_seconds (обратная совместимость + full_auto через ParseTargetsJob).
        $validated = $request->validate([
            'window_seconds'              => 'nullable|integer|min:60',
            'schedule'                    => 'nullable|array',
            'schedule.*.parsed_target_id' => 'required_with:schedule|integer',
            'schedule.*.offset_seconds'   => 'integer|min:0'
        ]);

        if (isset($validated['window_seconds'])) {
            $this->taskRepository->updateSpreadSeconds($id, (int) $validated['window_seconds']);
        }

        $offsets = null;
        if (!empty($validated['schedule'])) {
            $offsets = [];
            foreach ($validated['schedule'] as $entry) {
                $offsets[(int) $entry['parsed_target_id']] = (int) ($entry['offset_seconds'] ?? 0);
            }
        }

        $this->taskRepository->updateStatus($id, 'scheduling');

        ScheduleActionItemsJob::dispatch($id, $offsets);

        return response()->json([
            'success' => true,
            'data'    => ['task_id' => $id],
            'message' => 'Задача запущена'
        ]);
    }

    public function index(Request $request): JsonResponse {
        $tasks = $this->taskRepository->getByUser($request->user()->id);

        return response()->json([
            'success' => true,
            'data'    => $tasks,
            'message' => 'OK'
        ]);
    }

    public function show(int $id, Request $request): JsonResponse {
        $task = $this->taskRepository->findByIdAndUserWithCollectedTargets($id, $request->user()->id);

        if (!$task) {
            return $this->taskNotFound();
        }

        $task->load(['parseRun', 'instagramAccount']);

        return response()->json([
            'success' => true,
            'data'    => $task,
            'message' => 'OK'
        ]);
    }

    public function pause(int $id, Request $request): JsonResponse {
        return $this->changeTaskStatus($id, 'paused', 'Задача приостановлена', $request);
    }

    public function resume(int $id, Request $request): JsonResponse {
        return $this->changeTaskStatus($id, 'running', 'Задача возобновлена', $request);
    }

    public function cancel(int $id, Request $request): JsonResponse {
        return $this->changeTaskStatus($id, 'cancelled', 'Задача отменена', $request);
    }

    public function destroy(int $id, Request $request): JsonResponse {
        $task = $this->taskRepository->findByIdAndUser($id, $request->user()->id);

        if (!$task) {
            return $this->taskNotFound();
        }

        if (in_array($task->status, ['running', 'scheduling'], true)) {
            return response()->json([
                'success' => false,
                'error'   => 'Сначала отмените задачу'
            ], 422);
        }

        // Каскадно чистим связанные orphan-записи: parse_run — родитель task
        // (FK его не удаляет), parsed_targets ссылаются на parse_run. Порядок
        // важен из-за FK: цели → task → parse_run.
        $parseRunId = $task->parse_run_id !== null ? (int) $task->parse_run_id : null;

        DB::transaction(function () use ($id, $parseRunId): void {
            if ($parseRunId !== null) {
                $this->parsedTargetRepository->deleteByParseRun($parseRunId);
            }

            $this->taskRepository->delete($id);

            if ($parseRunId !== null) {
                $this->parseRunRepository->delete($parseRunId);
            }
        });

        return response()->json([
            'success' => true,
            'data'    => ['id' => $id],
            'message' => 'Задача удалена'
        ]);
    }

    private function changeTargetStatus(int $id, int $targetId, string $status, Request $request): JsonResponse {
        $task = $this->taskRepository->findByIdAndUser($id, $request->user()->id);

        if (!$task) {
            return $this->taskNotFound();
        }

        $target = $this->parsedTargetRepository->findByIdAndUser($targetId, $request->user()->id);

        if (!$target || (int) $target->parse_run_id !== (int) $task->parse_run_id) {
            return response()->json([
                'success' => false,
                'error'   => 'Цель не найдена'
            ], 404);
        }

        $this->parsedTargetRepository->updateStatus($targetId, $status);

        return response()->json([
            'success' => true,
            'data'    => ['id' => $targetId, 'status' => $status],
            'message' => 'OK'
        ]);
    }

    private function changeTaskStatus(int $id, string $status, string $message, Request $request): JsonResponse {
        $task = $this->taskRepository->findByIdAndUser($id, $request->user()->id);

        if (!$task) {
            return $this->taskNotFound();
        }

        $this->taskRepository->updateStatus($id, $status);

        return response()->json([
            'success' => true,
            'data'    => ['id' => $id, 'status' => $status],
            'message' => $message
        ]);
    }

    private function taskNotFound(): JsonResponse {
        return response()->json([
            'success' => false,
            'error'   => 'Задача не найдена'
        ], 404);
    }

    private function accountNotFound(): JsonResponse {
        return response()->json([
            'success' => false,
            'error'   => 'Аккаунт не найден'
        ], 404);
    }
}
