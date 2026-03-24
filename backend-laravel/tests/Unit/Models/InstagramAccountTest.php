<?php

declare(strict_types=1);

namespace Tests\Unit\Models;

use App\Models\DeviceProfile;
use App\Models\InstagramAccount;
use App\Models\User;
use Tests\TestCase;

class InstagramAccountTest extends TestCase {
    public function test_instagram_password_is_encrypted_on_save(): void {
        $account = InstagramAccount::factory()->create(['instagram_password' => 'secret123']);

        $raw = \DB::table('instagram_accounts')->where('id', $account->id)->value('instagram_password');

        $this->assertNotEquals('secret123', $raw);
        $this->assertEquals('secret123', $account->instagram_password);
    }

    public function test_session_data_is_encrypted_on_save(): void {
        $json = '{"uuids":{"phone_id":"abc"},"cookies":{},"last_login":0,"device_settings":{},"user_agent":"","country":"US","country_code":1,"locale":"en_US","timezone_offset":0,"authorization_data":{}}';

        $account = InstagramAccount::factory()->create(['session_data' => $json]);

        $raw = \DB::table('instagram_accounts')->where('id', $account->id)->value('session_data');

        $this->assertNotEquals($json, $raw);
        $this->assertEquals($json, $account->session_data);
    }

    public function test_session_data_nullable_stays_null(): void {
        $account = InstagramAccount::factory()->create(['session_data' => null]);

        $this->assertNull($account->session_data);
        $this->assertNull(\DB::table('instagram_accounts')->where('id', $account->id)->value('session_data'));
    }

    public function test_belongs_to_user(): void {
        $user = User::factory()->create();
        $account = InstagramAccount::factory()->create(['user_id' => $user->id]);

        $this->assertInstanceOf(User::class, $account->user);
        $this->assertEquals($user->id, $account->user->id);
    }

    public function test_belongs_to_device_profile(): void {
        $profile = DeviceProfile::factory()->create();
        $account = InstagramAccount::factory()->create(['device_profile_id' => $profile->id]);

        $this->assertInstanceOf(DeviceProfile::class, $account->deviceProfile);
        $this->assertEquals($profile->id, $account->deviceProfile->id);
    }

    public function test_fillable_contains_required_fields(): void {
        $account = new InstagramAccount();
        $fillable = $account->getFillable();

        foreach (['user_id', 'instagram_login', 'instagram_password', 'session_data', 'is_active'] as $field) {
            $this->assertContains($field, $fillable);
        }
    }
}
