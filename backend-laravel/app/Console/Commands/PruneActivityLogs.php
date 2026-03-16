<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Repositories\ActivityLogRepositoryInterface;
use Illuminate\Console\Command;

class PruneActivityLogs extends Command {
    protected $signature = 'activity:prune {--days=90 : Удалить логи старше N дней}';
    protected $description = 'Удалить старые логи активности аккаунтов';

    public function handle(ActivityLogRepositoryInterface $repository): int {
        $days  = (int) $this->option('days');
        $count = $repository->pruneOlderThan($days);

        $this->info("Удалено {$count} записей старше {$days} дней.");

        return self::SUCCESS;
    }
}
