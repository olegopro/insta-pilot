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

        ParseTargetsJob::dispatch((int) $task->parse_run_id);

        return response()->json([
            'success' => true,
            'data'    => ['parse_run_id' => (int) $task->parse_run_id],
            'message' => 'Парсинг целей запущен'
        ]);
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

        ScheduleActionItemsJob::dispatch($id);

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
        $task = $this->taskRepository->findByIdAndUser($id, $request->user()->id);

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
