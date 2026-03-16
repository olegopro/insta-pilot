<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\InstagramAccount;
use App\Repositories\ActivityLogRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ActivityLogController extends Controller {
    public function __construct(
        private readonly ActivityLogRepositoryInterface $repository,
    ) {}

    public function index(Request $request, int $accountId): JsonResponse {
        $account = InstagramAccount::findOrFail($accountId);

        if (!auth()->user()->hasRole('admin') && $account->user_id !== auth()->id()) {
            return response()->json(['success' => false, 'error' => 'Доступ запрещён'], 403);
        }

        $validated = $request->validate([
            'per_page'  => 'integer|min:1|max:100',
            'before_id' => 'nullable|integer',
            'after_id'  => 'nullable|integer',
            'around_id' => 'nullable|integer',
            'action'    => 'nullable|string',
            'status'    => 'nullable|string',
            'http_code' => 'nullable|integer',
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to'   => 'nullable|date_format:Y-m-d',
        ]);

        $result = $this->repository->getByAccount(
            accountId: $accountId,
            action:    $validated['action'] ?? null,
            status:    $validated['status'] ?? null,
            httpCode:  isset($validated['http_code']) ? (int) $validated['http_code'] : null,
            dateFrom:  $validated['date_from'] ?? null,
            dateTo:    $validated['date_to'] ?? null,
            perPage:   (int) ($validated['per_page'] ?? 50),
            beforeId:  isset($validated['before_id']) ? (int) $validated['before_id'] : null,
            afterId:   isset($validated['after_id']) ? (int) $validated['after_id'] : null,
            aroundId:  isset($validated['around_id']) ? (int) $validated['around_id'] : null,
        );

        return response()->json(['success' => true, 'data' => $result, 'message' => 'OK']);
    }

    public function stats(int $accountId): JsonResponse {
        $account = InstagramAccount::findOrFail($accountId);

        if (!auth()->user()->hasRole('admin') && $account->user_id !== auth()->id()) {
            return response()->json(['success' => false, 'error' => 'Доступ запрещён'], 403);
        }

        $stats = $this->repository->getStatsByAccount($accountId);

        return response()->json(['success' => true, 'data' => $stats, 'message' => 'OK']);
    }

    public function summary(): JsonResponse {
        $userId = auth()->user()->hasRole('admin') ? null : auth()->id();
        $summary = $this->repository->getSummary($userId);

        return response()->json(['success' => true, 'data' => $summary, 'message' => 'OK']);
    }
}
