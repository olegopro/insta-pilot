<?php

declare(strict_types=1);

namespace App\Services\Automation;

use App\Contracts\ActionPluginInterface;
use InvalidArgumentException;

final class ActionPluginRegistry implements ActionPluginRegistryInterface {
    /** @var array<string, ActionPluginInterface> */
    private array $plugins = [];

    /**
     * @param iterable<ActionPluginInterface> $plugins
     */
    public function __construct(iterable $plugins) {
        foreach ($plugins as $plugin) {
            $this->plugins[$plugin->key()] = $plugin;
        }
    }

    public function get(string $actionType): ActionPluginInterface {
        return $this->plugins[$actionType]
            ?? throw new InvalidArgumentException("Unknown automation action type: {$actionType}");
    }
}
