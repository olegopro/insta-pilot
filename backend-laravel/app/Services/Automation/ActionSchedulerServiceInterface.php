<?php

declare(strict_types=1);

namespace App\Services\Automation;

use App\Models\AutomationTask;

interface ActionSchedulerServiceInterface {
    public function scheduleTask(AutomationTask $task): void;
}
