<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\LlmSetting;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class LlmSettingsRepository implements LlmSettingsRepositoryInterface {
    public function getAll(): Collection {
        return LlmSetting::all();
    }

    public function findById(int $id): ?LlmSetting {
        return LlmSetting::find($id);
    }

    public function getDefault(): ?LlmSetting {
        return LlmSetting::where('is_default', true)->first();
    }

    public function upsert(string $provider, array $data): LlmSetting {
        $setting = LlmSetting::where('provider', $provider)->first()
            ?? new LlmSetting(['provider' => $provider]);

        $setting->fill($data);
        $setting->save();

        return $setting;
    }

    public function setDefault(int $id): void {
        DB::transaction(function () use ($id) {
            LlmSetting::where('is_default', true)->update(['is_default' => false]);
            LlmSetting::where('id', $id)->update(['is_default' => true]);
        });
    }

    public function delete(int $id): void {
        LlmSetting::where('id', $id)->delete();
    }
}
