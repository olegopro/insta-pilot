<?php

declare(strict_types=1);

namespace Tests\Unit\Services;

use App\Models\AccountActivityLog;
use App\Repositories\InstagramAccountRepositoryInterface;
use App\Services\ActivityLoggerServiceInterface;
use App\Services\InstagramClientService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * UNIT-тесты Showcase-методов InstagramClientService (Phase 1, read-only).
 * Роутов не требуют — гоняются изолированно через Http::fake().
 */
class ShowcaseClientServiceTest extends TestCase {
    private InstagramClientService $service;
    private ActivityLoggerServiceInterface $logger;
    private InstagramAccountRepositoryInterface $repo;

    protected function setUp(): void {
        parent::setUp();

        $this->logger = $this->createMock(ActivityLoggerServiceInterface::class);
        $this->logger->method('log')->willReturn($this->createMock(AccountActivityLog::class));

        $this->repo    = $this->createMock(InstagramAccountRepositoryInterface::class);
        $this->service = new InstagramClientService('http://python:8001', $this->logger, $this->repo);
    }

    // --- getOwnProfile ---

    public function test_get_own_profile_sends_session_data(): void {
        Http::fake(['http://python:8001/profile/info' => Http::response([
            'success'  => true,
            'user_pk'  => '42',
            'username' => 'me',
        ], 200)]);

        $this->service->getOwnProfile('my-session-json', 1);

        Http::assertSent(function (Request $request) {
            return $request->url() === 'http://python:8001/profile/info'
                && $request['session_data'] === 'my-session-json';
        });
    }

    public function test_get_own_profile_logs_when_account_id_provided(): void {
        Http::fake(['http://python:8001/profile/info' => Http::response(['success' => true], 200)]);

        $this->logger->expects($this->once())->method('log');

        $this->service->getOwnProfile('session', 7);
    }

    public function test_get_own_profile_does_not_log_when_account_id_null(): void {
        Http::fake(['http://python:8001/profile/info' => Http::response(['success' => true], 200)]);

        $this->logger->expects($this->never())->method('log');

        $this->service->getOwnProfile('session');
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('deactivationProvider')]
    public function test_get_own_profile_deactivation_by_error_code(string $errorCode, bool $expectsDeactivate): void {
        Http::fake(['http://python:8001/profile/info' => Http::response([
            'error'      => 'Error',
            'error_code' => $errorCode,
        ], 401)]);

        if ($expectsDeactivate) {
            $this->repo->expects($this->once())->method('deactivateAccount')->with(42);
        } else {
            $this->repo->expects($this->never())->method('deactivateAccount');
        }

        $this->service->getOwnProfile('session', 42);
    }

    public static function deactivationProvider(): array {
        return [
            'login_required deactivates'     => ['login_required', true],
            'challenge_required deactivates' => ['challenge_required', true],
            'rate_limited does not'          => ['rate_limited', false]
        ];
    }

    // --- getOwnMedias ---

    public function test_get_own_medias_sends_amount_and_end_cursor(): void {
        Http::fake(['http://python:8001/profile/medias' => Http::response([
            'success'        => true,
            'posts'          => [],
            'next_cursor'    => null,
            'more_available' => false,
        ], 200)]);

        $this->service->getOwnMedias('session', 'cursor-abc', 24, 1);

        Http::assertSent(function (Request $request) {
            return $request->url() === 'http://python:8001/profile/medias'
                && $request['amount'] === 24
                && $request['end_cursor'] === 'cursor-abc';
        });
    }

    public function test_get_own_medias_uses_default_amount(): void {
        Http::fake(['http://python:8001/profile/medias' => Http::response([
            'success' => true,
            'posts'   => [],
        ], 200)]);

        $this->service->getOwnMedias('session');

        Http::assertSent(fn (Request $r) => $r['amount'] === 12);
    }

    public function test_get_own_medias_omits_end_cursor_when_null(): void {
        Http::fake(['http://python:8001/profile/medias' => Http::response([
            'success' => true,
            'posts'   => [],
        ], 200)]);

        $this->service->getOwnMedias('session');

        Http::assertSent(fn (Request $r) => !isset($r['end_cursor']));
    }

    // --- getMediaInfo ---

    public function test_get_media_info_sends_media_pk(): void {
        Http::fake(['http://python:8001/media/info' => Http::response([
            'success' => true,
            'post'    => ['pk' => '999'],
        ], 200)]);

        $this->service->getMediaInfo('session', '999', 1);

        Http::assertSent(function (Request $request) {
            return $request->url() === 'http://python:8001/media/info'
                && $request['session_data'] === 'session'
                && $request['media_pk'] === '999';
        });
    }

    public function test_get_media_info_does_not_log_when_account_id_null(): void {
        Http::fake(['http://python:8001/media/info' => Http::response([
            'success' => true,
            'post'    => [],
        ], 200)]);

        $this->logger->expects($this->never())->method('log');

        $this->service->getMediaInfo('session', '999');
    }
}
