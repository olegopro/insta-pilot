<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\AutomationActionItem;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class AutomationActionItemRepository implements AutomationActionItemRepositoryInterface {
    public function create(array $data): AutomationActionItem {
        return AutomationActionItem::create($data);
    }

    public function createMany(array $items): bool {
        return AutomationActionItem::insert($items);
    }

    public function getDueItems(int $limit = 50): Collection {
        return AutomationActionItem::whereIn('status', [
            'pending',
            'scheduled'
        ])
            ->where('run_at', '<=', now())
            ->orderBy('run_at')
            ->limit($limit)
            ->get();
    }

    public function markRunning(int $id, string $claimToken, int $claimTtlSeconds = 300): bool {
        return AutomationActionItem::where('id', $id)
            ->whereIn('status', [
                'pending',
                'scheduled'
            ])
            ->where(static fn ($query) => $query
                ->whereNull('claim_expires_at')
                ->orWhere('claim_expires_at', '<=', now()))
            ->update([
                'status'           => 'running',
                'claim_token'      => $claimToken,
                'claimed_at'       => now(),
                'claim_expires_at' => now()->addSeconds($claimTtlSeconds),
                'attempts'         => DB::raw('attempts + 1')
            ]) > 0;
    }

    public function markDone(int $id, ?array $result = null, ?int $activityLogId = null): bool {
        return AutomationActionItem::where('id', $id)->update([
            'status'          => 'done',
            'result'          => $result,
            'activity_log_id' => $activityLogId,
            'executed_at'     => now()
        ]) > 0;
    }

    public function markFailed(int $id, ?string $errorCode = null, ?string $errorMessage = null): bool {
        return AutomationActionItem::where('id', $id)->update([
            'status'        => 'failed',
            'error_code'    => $errorCode,
            'error_message' => $errorMessage,
            'executed_at'   => now()
        ]) > 0;
    }
}
