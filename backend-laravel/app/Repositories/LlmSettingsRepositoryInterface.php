<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\LlmSetting;
use Illuminate\Database\Eloquent\Collection;

interface LlmSettingsRepositoryInterface {
    public function getAll(): Collection;

    public function findById(int $id): ?LlmSetting;

    public function getDefault(): ?LlmSetting;

    public function upsert(string $provider, array $data): LlmSetting;

    public function setDefault(int $id): void;

    public function delete(int $id): void;
}
