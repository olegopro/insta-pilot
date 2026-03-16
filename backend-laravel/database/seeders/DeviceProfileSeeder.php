<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\DeviceProfile;
use Illuminate\Database\Seeder;

class DeviceProfileSeeder extends Seeder {
    public function run(): void {
        $path = database_path('seeders/data/device-profiles/device-profiles.json');
        $rows = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);

        foreach ($rows as $row) {
            DeviceProfile::updateOrCreate(
                ['code' => $row['code']],
                [
                    'title'           => $row['title'],
                    'device_settings' => $row['device_settings'],
                    'user_agent'      => $row['user_agent'],
                    'is_active'       => (bool) ($row['is_active'] ?? true)
                ]
            );
        }
    }
}
