<?php

declare(strict_types=1);

namespace App\Services\Automation;

use App\Models\AutomationTask;

interface ActionSchedulerServiceInterface {
    /**
     * @param array<int, int>|null $offsets Карта parsed_target_id => offset_seconds (от now).
     *                                       null/пусто — равномерное распределение из spread_seconds.
     */
    public function scheduleTask(AutomationTask $task, ?array $offsets = null): void;
}
