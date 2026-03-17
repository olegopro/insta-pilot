<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\AccountActivityLog;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ActivityLogRepository implements ActivityLogRepositoryInterface {
    public function getByAccount(
        int $accountId,
        ?string $action = null,
        ?string $status = null,
        ?int $httpCode = null,
        ?string $dateFrom = null,
        ?string $dateTo = null,
        int $perPage = 50,
        ?int $beforeId = null,
        ?int $afterId = null,
        ?int $aroundId = null,
    ): array {
        if ($aroundId !== null) {
            return $this->getAroundId($accountId, $aroundId, $perPage);
        }

        $query = AccountActivityLog::where('instagram_account_id', $accountId);

        $action !== null && $query->where('action', $action);
        $status !== null && $query->where('status', $status);
        $httpCode !== null && $query->where('http_code', $httpCode);
        $dateFrom !== null && $query->whereDate('created_at', '>=', $dateFrom);
        $dateTo !== null && $query->whereDate('created_at', '<=', $dateTo);

        $total = $query->count();

        if ($beforeId !== null) {
            $query->where('id', '<', $beforeId);
        }

        if ($afterId !== null) {
            $query->where('id', '>', $afterId);
        }

        $items = $query
            ->orderBy('id', 'desc')
            ->limit($perPage + 1)
            ->get();

        $hasMore = $items->count() > $perPage;
        $items = $items->take($perPage)->values();

        return [
            'items'           => $items->toArray(),
            'has_more_before' => $hasMore,
            'has_more_after'  => false,
            'total'           => $total,
            'focused_id'      => null,
        ];
    }

    private function getAroundId(int $accountId, int $aroundId, int $perPage): array {
        $half = intdiv($perPage, 2);

        $before = AccountActivityLog::where('instagram_account_id', $accountId)
            ->where('id', '<=', $aroundId)
            ->orderBy('id', 'desc')
            ->limit($half + 1)
            ->get();

        $after = AccountActivityLog::where('instagram_account_id', $accountId)
            ->where('id', '>', $aroundId)
            ->orderBy('id', 'asc')
            ->limit($half)
            ->get();

        $hasMoreBefore = $before->count() > $half;
        $items = $before->take($half)->reverse()->values()->merge($after)->values();

        $total = AccountActivityLog::where('instagram_account_id', $accountId)->count();

        return [
            'items'           => $items->toArray(),
            'has_more_before' => $hasMoreBefore,
            'has_more_after'  => $after->count() >= $half,
            'total'           => $total,
            'focused_id'      => $aroundId,
        ];
    }

    public function getStatsByAccount(int $accountId): array {
        $base = AccountActivityLog::where('instagram_account_id', $accountId);

        $total = $base->count();
        $today = (clone $base)->whereDate('created_at', today())->count();
        $successCount = (clone $base)->where('status', 'success')->count();
        $successRate = $total > 0 ? round($successCount / $total * 100, 1) : 0.0;

        $byAction = (clone $base)
            ->select('action', DB::raw('count(*) as total'))
            ->selectRaw("sum(case when status = 'success' then 1 else 0 end) as success")
            ->selectRaw("sum(case when status != 'success' then 1 else 0 end) as error")
            ->groupBy('action')
            ->get()
            ->keyBy('action')
            ->map(static fn ($row) => [
                'total'   => (int) $row->total,
                'success' => (int) $row->success,
                'error'   => (int) $row->error,
            ])
            ->toArray();

        $byStatus = (clone $base)
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->map(static fn ($count) => (int) $count)
            ->toArray();

        $avgDuration = (int) ((clone $base)->whereNotNull('duration_ms')->avg('duration_ms') ?? 0);

        $lastError = (clone $base)
            ->where('status', '!=', 'success')
            ->orderBy('id', 'desc')
            ->first(['action', 'error_message', 'error_code', 'created_at']);

        return [
            'total'           => $total,
            'today'           => $today,
            'success_rate'    => $successRate,
            'by_action'       => $byAction,
            'by_status'       => $byStatus,
            'avg_duration_ms' => $avgDuration,
            'last_error'      => $lastError ? [
                'action'        => $lastError->action,
                'error_message' => $lastError->error_message,
                'error_code'    => $lastError->error_code,
                'created_at'    => $lastError->created_at->toISOString(),
            ] : null,
        ];
    }

    public function getSummary(?int $userId = null): Collection {
        $query = DB::table('account_activity_logs as al')
            ->join('instagram_accounts as ia', 'ia.id', '=', 'al.instagram_account_id')
            ->select([
                'ia.id as account_id',
                'ia.instagram_login',
                DB::raw('count(*) as total_actions'),
                DB::raw("sum(case when al.created_at::date = current_date then 1 else 0 end) as today_actions"),
                DB::raw("sum(case when al.status != 'success' and al.created_at::date = current_date then 1 else 0 end) as error_count_today"),
                DB::raw("round(sum(case when al.status = 'success' then 1 else 0 end) * 100.0 / count(*), 1) as success_rate"),
                DB::raw('max(al.created_at) as last_activity_at'),
            ])
            ->groupBy('ia.id', 'ia.instagram_login');

        $userId !== null && $query->where('ia.user_id', $userId);

        return $query->get()->map(static function ($row) {
            $row->success_rate = (float) $row->success_rate;
            return $row;
        });
    }

    public function pruneOlderThan(int $days): int {
        return AccountActivityLog::where('created_at', '<', now()->subDays($days))->delete();
    }
}
