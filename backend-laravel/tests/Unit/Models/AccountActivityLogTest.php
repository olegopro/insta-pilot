<?php

declare(strict_types=1);

namespace Tests\Unit\Models;

use App\Models\AccountActivityLog;
use App\Models\InstagramAccount;
use App\Models\User;
use Tests\TestCase;

class AccountActivityLogTest extends TestCase {
    public function test_request_payload_is_cast_to_array(): void {
        $log = AccountActivityLog::factory()->create([
            'request_payload' => ['media_id' => '12345_67890', 'text' => 'hi'],
        ]);

        $fresh = AccountActivityLog::find($log->id);

        $this->assertIsArray($fresh->request_payload);
        $this->assertEquals('12345_67890', $fresh->request_payload['media_id']);
    }

    public function test_response_summary_is_cast_to_array(): void {
        $log = AccountActivityLog::factory()->create([
            'response_summary' => ['success' => true, 'items_count' => 5],
        ]);

        $fresh = AccountActivityLog::find($log->id);

        $this->assertIsArray($fresh->response_summary);
        $this->assertEquals(5, $fresh->response_summary['items_count']);
    }

    public function test_timestamps_disabled(): void {
        $log = new AccountActivityLog();

        $this->assertFalse($log->timestamps);
    }

    public function test_belongs_to_instagram_account(): void {
        $account = InstagramAccount::factory()->create();
        $log = AccountActivityLog::factory()->create(['instagram_account_id' => $account->id]);

        $this->assertInstanceOf(InstagramAccount::class, $log->instagramAccount);
        $this->assertEquals($account->id, $log->instagramAccount->id);
    }

    public function test_belongs_to_user(): void {
        $user = User::factory()->create();
        $log  = AccountActivityLog::factory()->create(['user_id' => $user->id]);

        $this->assertInstanceOf(User::class, $log->user);
        $this->assertEquals($user->id, $log->user->id);
    }

    public function test_request_payload_nullable_stays_null(): void {
        $log = AccountActivityLog::factory()->create(['request_payload' => null]);

        $this->assertNull(AccountActivityLog::find($log->id)->request_payload);
    }
}
