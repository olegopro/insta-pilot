<?php

declare(strict_types=1);

namespace Tests\Unit\Services;

use App\Events\ActivityLogCreated;
use App\Models\AccountActivityLog;
use App\Models\InstagramAccount;
use App\Models\User;
use App\Services\ActivityLoggerService;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class ActivityLoggerServiceTest extends TestCase {
    private ActivityLoggerService $service;
    private InstagramAccount $account;
    private User $user;

    protected function setUp(): void {
        parent::setUp();
        $this->service = new ActivityLoggerService();
        $this->account = InstagramAccount::factory()->create();
        $this->user    = User::factory()->create();
    }

    public function test_log_creates_record_in_db(): void {
        $this->service->log(
            accountId: $this->account->id,
            userId:    $this->user->id,
            action:    'like',
            status:    'success',
            httpCode:  200,
            endpoint:  '/media/like',
        );

        $this->assertDatabaseHas('account_activity_logs', [
            'instagram_account_id' => $this->account->id,
            'user_id'              => $this->user->id,
            'action'               => 'like',
            'status'               => 'success',
            'http_code'            => 200,
        ]);
    }

    public function test_log_broadcasts_activity_log_created(): void {
        Event::fake([ActivityLogCreated::class]);

        $log = $this->service->log(
            accountId: $this->account->id,
            userId:    $this->user->id,
            action:    'comment',
            status:    'success',
        );

        Event::assertDispatched(
            ActivityLogCreated::class,
            fn (ActivityLogCreated $event) => $event->log->id === $log->id
        );
    }

    public function test_log_batch_creates_multiple_records(): void {
        $logs = $this->service->logBatch($this->account->id, $this->user->id, [
            ['action' => 'like',    'status' => 'success'],
            ['action' => 'comment', 'status' => 'fail'],
        ]);

        $this->assertCount(2, $logs);
        $this->assertDatabaseHas('account_activity_logs', ['action' => 'like',    'status' => 'success']);
        $this->assertDatabaseHas('account_activity_logs', ['action' => 'comment', 'status' => 'fail']);
    }

    public static function sensitiveKeyProvider(): array {
        return [
            'session_data'       => [['session_data' => 'secret-session', 'endpoint' => '/auth/login'], 'session_data',       'endpoint'],
            'password'           => [['password' => 'mypassword',         'login' => 'user123'],        'password',           'login'],
            'instagram_password' => [['instagram_password' => 'secret',   'login' => 'user123'],        'instagram_password', 'login'],
            'cookie'             => [['cookie' => 'c=1',                  'action' => 'login'],         'cookie',             'action'],
            'token'              => [['token' => 'abc',                   'action' => 'login'],         'token',              'action'],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('sensitiveKeyProvider')]
    public function test_sanitize_removes_sensitive_key(array $payload, string $removedKey, string $keptKey): void {
        Event::fake();

        $this->service->log(
            accountId:      $this->account->id,
            userId:         $this->user->id,
            action:         'login',
            status:         'success',
            requestPayload: $payload,
        );

        $stored = AccountActivityLog::first()->request_payload;
        $this->assertArrayNotHasKey($removedKey, $stored);
        $this->assertArrayHasKey($keptKey, $stored);
    }

    public function test_sanitize_keeps_safe_fields(): void {
        Event::fake();

        $this->service->log(
            accountId:      $this->account->id,
            userId:         $this->user->id,
            action:         'like',
            status:         'success',
            requestPayload: ['media_pk' => '12345', 'endpoint' => '/media/like', 'items_count' => 10],
        );

        $stored = AccountActivityLog::first()->request_payload;
        $this->assertEquals('12345', $stored['media_pk']);
        $this->assertEquals('/media/like', $stored['endpoint']);
        $this->assertEquals(10, $stored['items_count']);
    }

    public function test_sanitize_does_not_recurse_into_nested_objects(): void {
        Event::fake();

        $this->service->log(
            accountId:      $this->account->id,
            userId:         $this->user->id,
            action:         'login',
            status:         'success',
            requestPayload: [
                'python_request' => ['session_data' => 'nested-secret', 'endpoint' => '/auth/login'],
            ],
        );

        $stored = AccountActivityLog::first()->request_payload;
        // Верхний уровень: 'python_request' не является sensitive ключом — остаётся
        $this->assertArrayHasKey('python_request', $stored);
        // Вложенный 'session_data' не фильтруется (только top-level)
        $this->assertArrayHasKey('session_data', $stored['python_request']);
    }
}
