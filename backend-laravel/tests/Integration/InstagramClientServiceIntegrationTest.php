<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Models\AccountActivityLog;
use App\Models\InstagramAccount;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Integration-тесты для взаимодействия Laravel ↔ Python.
 *
 * Требования: Docker-контейнер python запущен.
 * Запуск: php artisan test --testsuite=Integration
 *
 * Проверки, требующие реального Instagram-аккаунта (login → session_data,
 * feed → posts, add_like, media_comments, search_hashtag), выполняются
 * вручную — чек-лист в DEBUG_PROTOCOL.md (раздел «Ручные проверки с живым
 * аккаунтом»), фикстуры — в _TEST/fixtures/session.json.
 */
class InstagramClientServiceIntegrationTest extends TestCase {
    private string $pythonUrl;
    private User $user;
    private InstagramAccount $account;

    protected function setUp(): void {
        parent::setUp();

        // Внутри Docker: http://python:8001, снаружи: http://localhost:8001
        $this->pythonUrl = env('INTEGRATION_PYTHON_URL', config('services.instagram.python_url', 'http://localhost:8001'));
        $this->skipIfPythonUnavailable();

        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'user', 'guard_name' => 'web']);

        $this->user = User::factory()->create();
        $this->user->assignRole('user');

        $this->account = InstagramAccount::factory()->create([
            'user_id'            => $this->user->id,
            'instagram_login'    => 'integration_test_user',
            'instagram_password' => 'fake_password',
            'session_data'       => $this->makeInvalidSessionData(),
        ]);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function skipIfPythonUnavailable(): void {
        try {
            $response = Http::timeout(2)->get("{$this->pythonUrl}/health");

            if (!$response->ok()) {
                $this->markTestSkipped('Python service недоступен (не 200 от /health)');
            }
        } catch (\Exception) {
            $this->markTestSkipped("Python service недоступен по адресу {$this->pythonUrl}");
        }
    }

    private function makeInvalidSessionData(): string {
        return json_encode([
            'uuids'              => [
                'phone_id'          => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                'uuid'              => 'ffffffff-0000-1111-2222-333333333333',
                'client_session_id' => '11111111-2222-3333-4444-555555555555',
                'advertising_id'    => '66666666-7777-8888-9999-aaaaaaaaaaaa',
                'device_id'         => 'android-bbbbbbbbbbbbbbbb',
            ],
            'cookies'            => [
                'csrftoken'  => 'fake_csrf',
                'ds_user_id' => '000000001',
                'sessionid'  => 'fake_session_id_invalid',
            ],
            'last_login'         => 1700000000.0,
            'device_settings'    => [
                'app_version'     => '269.0.0.18.75',
                'android_version' => 28,
                'android_release' => '9.0',
                'dpi'             => '480dpi',
                'resolution'      => '1080x2154',
                'manufacturer'    => 'Samsung',
                'device'          => 'SM-G965F',
                'model'           => 'star2qltecs',
                'cpu'             => 'qcom',
                'version_code'    => '314665256',
            ],
            'user_agent'         => 'Instagram 269.0.0.18.75 Android (28/9.0; 480dpi; 1080x2154; samsung; SM-G965F; star2qltecs; qcom; en_US; 314665256)',
            'country'            => 'US',
            'country_code'       => 1,
            'locale'             => 'en_US',
            'timezone_offset'    => -14400,
            'authorization_data' => [
                'ds_user_id' => '000000001',
                'sessionid'  => 'fake_session_id_invalid',
            ],
        ]);
    }

    // ─── Python health ────────────────────────────────────────────────────────

    public function test_python_health_endpoint_returns_ok(): void {
        $response = Http::get("{$this->pythonUrl}/health");

        $this->assertTrue($response->ok());
        $this->assertEquals('ok', $response->json('status'));
    }

    // ─── Pydantic validation (нет обращения к Instagram) ─────────────────────

    #[DataProvider('pydanticInvalidSessionProvider')]
    public function test_python_returns_422_for_invalid_session_data(array $payload, string $endpoint): void {
        $response = Http::post("{$this->pythonUrl}{$endpoint}", $payload);

        $this->assertEquals(422, $response->status());
    }

    public static function pydanticInvalidSessionProvider(): array {
        return [
            'missing session_data' => [[], '/account/feed'],
            // null не проходит Pydantic-валидацию → 422
            'null session_data'    => [['session_data' => null], '/account/info'],
        ];
    }

    // ─── Laravel → Python ошибка (без реального Instagram) ───────────────────

    #[DataProvider('activityLogOnErrorProvider')]
    public function test_endpoint_records_activity_log_on_error(string $endpointTemplate, string $action): void {
        $this->actingAs($this->user, 'sanctum');

        // account->id известен только в рантайме (создаётся в setUp), поэтому в DataProvider — шаблон
        $endpoint = str_replace('{accountId}', (string) $this->account->id, $endpointTemplate);
        $response = $this->getJson($endpoint);

        // Python вернёт ошибку (невалидная сессия), Laravel должен вернуть не 500
        $this->assertNotEquals(500, $response->status());

        // ActivityLog должен быть записан
        $this->assertDatabaseHas('account_activity_logs', [
            'instagram_account_id' => $this->account->id,
            'action'               => $action,
        ]);

        $log = AccountActivityLog::where('instagram_account_id', $this->account->id)
            ->where('action', $action)
            ->first();

        $this->assertNotNull($log);
        // Статус — error_code из Python (login_required, error и т.д.), но не success
        $this->assertNotEquals('success', $log->status);
    }

    public static function activityLogOnErrorProvider(): array {
        return [
            'feed'           => ['/api/feed/{accountId}', 'fetch_feed'],
            'search_hashtag' => ['/api/search/hashtag?account_id={accountId}&tag=nature', 'search_hashtag'],
        ];
    }

    public function test_python_error_response_does_not_expose_traceback(): void {
        $response = Http::post("{$this->pythonUrl}/account/feed", [
            'session_data' => $this->makeInvalidSessionData(),
        ]);

        $body = $response->body();

        $this->assertStringNotContainsStringIgnoringCase('traceback', $body);
        $this->assertStringNotContainsStringIgnoringCase('file "', $body);
    }

    public function test_python_error_response_has_consistent_structure(): void {
        $response = Http::post("{$this->pythonUrl}/account/info", [
            'session_data' => $this->makeInvalidSessionData(),
        ]);

        // Должен вернуть либо успех, либо ошибку с полями success + error_code
        $json = $response->json();
        $this->assertArrayHasKey('success', $json);

        if (!$json['success']) {
            $this->assertArrayHasKey('error_code', $json);
        }
    }
}
