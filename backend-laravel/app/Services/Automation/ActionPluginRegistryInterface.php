<?php

declare(strict_types=1);

namespace App\Services\Automation;

use App\Contracts\ActionPluginInterface;

interface ActionPluginRegistryInterface {
    public function get(string $actionType): ActionPluginInterface;
}
