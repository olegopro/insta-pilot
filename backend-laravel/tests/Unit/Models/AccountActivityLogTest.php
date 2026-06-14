<?php

declare(strict_types=1);

namespace Tests\Unit\Models;

use App\Models\AccountActivityLog;
use App\Models\InstagramAccount;
use App\Models\User;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AccountActivityLogTest extends TestCase {
    #[DataProvider('jsonArrayCastProvider')]
    public function test_json_fields_are_cast_to_array(
        string $field,
        ?array $value,
        ?string $assertKey,
        mixed $assertExpected
    ): void {
        $log = AccountActivityLog::factory()->create([$field => $value]);

        $fresh = AccountActivityLog::find($log->id);

        if ($value === null) {
            $this->assertNull($fresh->{$field});

            return;
        }

        $this->assertIsArray($fresh->{$field});
        $this->assertEquals($assertExpected, $fresh->{$field}[$assertKey]);
    }

    public static function jsonArrayCastProvider(): array {
        return [
            'request_payload cast to array' => [
                'request_payload',
                ['media_id' => '12345_67890', 'text' => 'hi'],
                'media_id',
                '12345_67890'
            ],
            'response_summary cast to array' => [
                'response_summary',
                ['success' => true, 'items_count' => 5],
                'items_count',
                5
            ],
            'request_payload nullable stays null' => [
                'request_payload',
                null,
                null,
                null
            ]
        ];
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
}
