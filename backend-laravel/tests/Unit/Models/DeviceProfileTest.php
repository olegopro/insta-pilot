<?php

declare(strict_types=1);

namespace Tests\Unit\Models;

use App\Models\DeviceProfile;
use App\Models\InstagramAccount;
use Tests\TestCase;

class DeviceProfileTest extends TestCase {
    public function test_has_many_instagram_accounts(): void {
        $profile = DeviceProfile::factory()->create();
        InstagramAccount::factory()->count(2)->create(['device_profile_id' => $profile->id]);

        $this->assertCount(2, $profile->instagramAccounts);
    }
}
