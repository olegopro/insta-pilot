<?php

declare(strict_types=1);

namespace Tests\Unit\Models;

use App\Models\DeviceProfile;
use App\Models\InstagramAccount;
use Tests\TestCase;

class DeviceProfileTest extends TestCase {
    public function test_device_settings_is_cast_to_array(): void {
        $profile = DeviceProfile::factory()->create([
            'device_settings' => ['manufacturer' => 'Samsung', 'model' => 'SM-G965F'],
        ]);

        $fresh = DeviceProfile::find($profile->id);

        $this->assertIsArray($fresh->device_settings);
        $this->assertEquals('Samsung', $fresh->device_settings['manufacturer']);
    }

    public function test_is_active_cast_to_boolean(): void {
        $active   = DeviceProfile::factory()->create(['is_active' => true]);
        $inactive = DeviceProfile::factory()->create(['is_active' => false]);

        $this->assertTrue(DeviceProfile::find($active->id)->is_active);
        $this->assertFalse(DeviceProfile::find($inactive->id)->is_active);
    }

    public function test_has_many_instagram_accounts(): void {
        $profile = DeviceProfile::factory()->create();
        InstagramAccount::factory()->count(2)->create(['device_profile_id' => $profile->id]);

        $this->assertCount(2, $profile->instagramAccounts);
    }

    public function test_fillable_contains_required_fields(): void {
        $fillable = (new DeviceProfile())->getFillable();

        $fields = [
            'code',
            'title',
            'device_settings',
            'user_agent',
            'is_active'
        ];
        foreach ($fields as $field) {
            $this->assertContains($field, $fillable);
        }
    }
}
