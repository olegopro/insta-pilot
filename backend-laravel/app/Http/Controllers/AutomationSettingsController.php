<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\AccountActionLimit;
use App\Models\AccountWorkingHours;
use App\Repositories\InstagramAccountRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AutomationSettingsController extends Controller {
    public function __construct(
        private readonly InstagramAccountRepositoryInterface $accountRepository
    ) {}

    public function show(int $accountId, Request $request): JsonResponse {
        $account = $this->accountRepository->findByIdAndUser($accountId, (int) $request->user()->id);

        if (!$account) {
            return response()->json(['success' => false, 'error' => 'Аккаунт не найден'], 404);
        }

        $limits = AccountActionLimit::where('instagram_account_id', $account->id)
            ->get()
            ->map(fn (AccountActionLimit $limit) => [
                'action'                 => $limit->action,
                'daily_limit'            => (int) $limit->daily_limit,
                'min_action_spacing_sec' => $limit->min_action_spacing_sec,
                'is_active'              => (bool) $limit->is_active
            ])
            ->values()
            ->all();

        $hours = AccountWorkingHours::where('instagram_account_id', $account->id)->first();

        $workingHours = [
            'schedule'   => $hours?->schedule ?? [],
            'timezone'   => $hours?->timezone ?? 'UTC',
            'is_enabled' => $hours ? (bool) $hours->is_enabled : false
        ];

        return response()->json([
            'success' => true,
            'data'    => [
                'limits'        => $limits,
                'working_hours' => $workingHours
            ],
            'message' => 'OK'
        ]);
    }

    public function updateLimits(int $accountId, Request $request): JsonResponse {
        $account = $this->accountRepository->findByIdAndUser($accountId, (int) $request->user()->id);

        if (!$account) {
            return response()->json(['success' => false, 'error' => 'Аккаунт не найден'], 404);
        }

        $validated = $request->validate([
            'limits'                          => 'required|array',
            'limits.*.action'                 => 'required|string|in:like,comment,follow,unfollow',
            'limits.*.daily_limit'            => 'required|integer|min:0',
            'limits.*.min_action_spacing_sec' => 'nullable|integer|min:0',
            'limits.*.is_active'              => 'required|boolean'
        ]);

        foreach ($validated['limits'] as $limit) {
            AccountActionLimit::updateOrCreate(
                [
                    'instagram_account_id' => $account->id,
                    'action'               => $limit['action']
                ],
                [
                    'user_id'                => $account->user_id,
                    'daily_limit'            => $limit['daily_limit'],
                    'min_action_spacing_sec' => $limit['min_action_spacing_sec'] ?? null,
                    'is_active'              => $limit['is_active']
                ]
            );
        }

        return response()->json(['success' => true, 'data' => null, 'message' => 'Лимиты сохранены']);
    }

    public function updateWorkingHours(int $accountId, Request $request): JsonResponse {
        $account = $this->accountRepository->findByIdAndUser($accountId, (int) $request->user()->id);

        if (!$account) {
            return response()->json(['success' => false, 'error' => 'Аккаунт не найден'], 404);
        }

        $validated = $request->validate([
            'schedule'   => 'required|array',
            'timezone'   => 'required|string',
            'is_enabled' => 'required|boolean'
        ]);

        AccountWorkingHours::updateOrCreate(
            ['instagram_account_id' => $account->id],
            [
                'user_id'    => $account->user_id,
                'schedule'   => $validated['schedule'],
                'timezone'   => $validated['timezone'],
                'is_enabled' => $validated['is_enabled']
            ]
        );

        return response()->json(['success' => true, 'data' => null, 'message' => 'Рабочие часы сохранены']);
    }
}
