<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Jobs\ExecuteActionItemJob;
use App\Models\AutomationActionItem;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

final class AutomationDispatchCommand extends Command {
    protected $signature = 'automation:dispatch {--limit=50}';

    protected $description = 'Dispatch due automation action items and reap expired claims.';

    public function handle(): int {
        $limit = max(1, (int) $this->option('limit'));

        $this->reapExpiredClaims();

        $items = DB::transaction(function () use ($limit) {
            return AutomationActionItem::where('status', 'scheduled')
                ->where('run_at', '<=', now())
                ->orderBy('run_at')
                ->limit($limit)
                ->lock('FOR UPDATE SKIP LOCKED')
                ->get([
                    'id',
                    'action_type'
                ]);
        });

        foreach ($items as $item) {
            ExecuteActionItemJob::dispatch((int) $item->id, (string) $item->action_type);
        }

        $this->info("Dispatched {$items->count()} automation action item(s).");

        return self::SUCCESS;
    }

    private function reapExpiredClaims(): void {
        AutomationActionItem::where('status', 'running')
            ->where('claim_expires_at', '<', now())
            ->update([
                'status' => 'scheduled',
                'claim_token' => null,
                'claimed_at' => null,
                'claim_expires_at' => null,
                'updated_at' => now()
            ]);
    }
}
