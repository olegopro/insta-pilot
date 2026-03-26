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

class InstagramClientServiceTest extends TestCase {
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

    // --- login ---

    public function test_login_sends_credentials_to_python(): void {
        Http::fake(['http://python:8001/auth/login' => Http::response(['session_data' => '{}'], 200)]);

        $this->service->login('myuser', 'mypass');

        Http::assertSent(function (Request $request) {
            return $request->url() === 'http://python:8001/auth/login'
                && $request['login'] === 'myuser'
                && $request['password'] === 'mypass';
        });
    }

    public function test_login_returns_python_response(): void {
        Http::fake(['http://python:8001/auth/login' => Http::response(['session_data' => '{"key":"val"}'], 200)]);

        $result = $this->service->login('user', 'pass');

        $this->assertEquals('{"key":"val"}', $result['session_data']);
    }

    public function test_login_logs_when_account_id_provided(): void {
        Http::fake(['http://python:8001/auth/login' => Http::response(['session_data' => '{}'], 200)]);

        $this->logger->expects($this->once())->method('log');

        $this->service->login('user', 'pass', null, 99);
    }

    public function test_login_does_not_log_when_account_id_null(): void {
        Http::fake(['http://python:8001/auth/login' => Http::response(['session_data' => '{}'], 200)]);

        $this->logger->expects($this->never())->method('log');

        $this->service->login('user', 'pass');
    }

    // --- getUserInfo ---

    public function test_get_user_info_sends_session_data(): void {
        Http::fake(['http://python:8001/account/info' => Http::response(['user_pk' => '123'], 200)]);

        $this->service->getUserInfo('my-session-json', 1);

        Http::assertSent(function (Request $request) {
            return $request->url() === 'http://python:8001/account/info'
                && $request['session_data'] === 'my-session-json';
        });
    }

    public function test_get_user_info_deactivates_on_login_required(): void {
        Http::fake(['http://python:8001/account/info' => Http::response([
            'error'      => 'Login required',
            'error_code' => 'login_required',
        ], 401)]);

        $this->repo->expects($this->once())->method('deactivateAccount')->with(42);

        $this->service->getUserInfo('session', 42);
    }

    public function test_get_user_info_deactivates_on_challenge_required(): void {
        Http::fake(['http://python:8001/account/info' => Http::response([
            'error'      => 'Challenge required',
            'error_code' => 'challenge_required',
        ], 401)]);

        $this->repo->expects($this->once())->method('deactivateAccount')->with(7);

        $this->service->getUserInfo('session', 7);
    }

    public function test_get_user_info_does_not_deactivate_on_rate_limited(): void {
        Http::fake(['http://python:8001/account/info' => Http::response([
            'error'      => 'Rate limited',
            'error_code' => 'rate_limited',
        ], 429)]);

        $this->repo->expects($this->never())->method('deactivateAccount');

        $this->service->getUserInfo('session', 5);
    }

    // --- addLike ---

    public function test_add_like_sends_media_id(): void {
        Http::fake(['http://python:8001/media/like' => Http::response(['success' => true], 200)]);

        $this->service->addLike('session', '12345_67890', 1);

        Http::assertSent(function (Request $request) {
            return $request->url() === 'http://python:8001/media/like'
                && $request['media_id'] === '12345_67890';
        });
    }

    public function test_add_like_always_logs(): void {
        Http::fake(['http://python:8001/media/like' => Http::response(['success' => true], 200)]);

        $this->logger->expects($this->once())->method('log');

        $this->service->addLike('session', 'media-id', 1);
    }

    // --- getFeed ---

    public function test_get_feed_cold_start_sends_no_max_id(): void {
        Http::fake(['http://python:8001/account/feed' => Http::response([
            'posts'          => [],
            'more_available' => false,
            'debug_info'     => [],
        ], 200)]);

        $this->service->getFeed('session', 1);

        Http::assertSent(function (Request $request) {
            return $request->url() === 'http://python:8001/account/feed'
                && !isset($request['max_id']);
        });
    }

    public function test_get_feed_sends_max_id_and_seen_posts(): void {
        Http::fake(['http://python:8001/account/feed' => Http::response([
            'posts'          => [],
            'more_available' => false,
            'debug_info'     => [],
        ], 200)]);

        $this->service->getFeed('session', 1, 'cursor-abc', 'pk_111,pk_222');

        Http::assertSent(function (Request $request) {
            return $request['max_id'] === 'cursor-abc'
                && $request['seen_posts'] === 'pk_111,pk_222';
        });
    }

    // --- searchHashtag ---

    public function test_search_hashtag_sends_hashtag_and_amount(): void {
        Http::fake(['http://python:8001/search/hashtag' => Http::response([
            'items'      => [],
            'debug_info' => [],
        ], 200)]);

        $this->service->searchHashtag('session', 1, 'travel', 50, 'cursor-xyz');

        Http::assertSent(function (Request $request) {
            return $request->url() === 'http://python:8001/search/hashtag'
                && $request['hashtag'] === 'travel'
                && $request['amount'] === 50
                && $request['next_max_id'] === 'cursor-xyz';
        });
    }

    public function test_search_hashtag_omits_next_max_id_when_null(): void {
        Http::fake(['http://python:8001/search/hashtag' => Http::response(['items' => [], 'debug_info' => []], 200)]);

        $this->service->searchHashtag('session', 1, 'travel');

        Http::assertSent(fn (Request $r) => !isset($r['next_max_id']));
    }

    // --- searchLocations ---

    public function test_search_locations_sends_query(): void {
        Http::fake(['http://python:8001/search/locations' => Http::response([
            'locations' => [],
            'debug_info' => [],
        ], 200)]);

        $this->service->searchLocations('session', 1, 'Moscow');

        Http::assertSent(fn (Request $r) => $r['query'] === 'Moscow');
    }

    // --- searchLocationMedias ---

    public function test_search_location_medias_sends_location_pk(): void {
        Http::fake(['http://python:8001/search/location' => Http::response([
            'items'      => [],
            'debug_info' => [],
        ], 200)]);

        $this->service->searchLocationMedias('session', 1, 123456, 30, 'cursor-loc');

        Http::assertSent(function (Request $request) {
            return $request['location_pk'] === 123456
                && $request['next_max_id'] === 'cursor-loc';
        });
    }

    // --- commentMedia ---

    public function test_comment_media_sends_media_id_and_text(): void {
        Http::fake(['http://python:8001/media/comment' => Http::response([
            'comment_pk' => '999',
            'debug_info' => [],
        ], 200)]);

        $this->service->commentMedia('session', 1, 'media-123', 'Nice photo!');

        Http::assertSent(function (Request $request) {
            return $request['media_id'] === 'media-123'
                && $request['text'] === 'Nice photo!';
        });
    }

    // --- fetchMediaComments ---

    public function test_fetch_media_comments_sends_min_id_when_provided(): void {
        Http::fake(['http://python:8001/media/comments' => Http::response([
            'comments'      => [],
            'comment_count' => 0,
            'next_min_id'   => null,
            'debug_info'    => [],
        ], 200)]);

        $this->service->fetchMediaComments('session', 1, 'media-pk', 'min-cursor');

        Http::assertSent(fn (Request $r) => $r['min_id'] === 'min-cursor');
    }

    public function test_fetch_media_comments_omits_min_id_when_null(): void {
        Http::fake(['http://python:8001/media/comments' => Http::response([
            'comments'      => [],
            'comment_count' => 0,
            'next_min_id'   => null,
            'debug_info'    => [],
        ], 200)]);

        $this->service->fetchMediaComments('session', 1, 'media-pk');

        Http::assertSent(fn (Request $r) => !isset($r['min_id']));
    }

    // --- getUserInfoByPk ---

    public function test_get_user_info_by_pk_sends_session_and_user_pk(): void {
        Http::fake(['http://python:8001/user/info' => Http::response([
            'success' => true,
            'user'    => ['pk' => '42', 'username' => 'testuser'],
        ], 200)]);

        $this->service->getUserInfoByPk('my-session', '42', 1);

        Http::assertSent(function (Request $request) {
            return $request->url() === 'http://python:8001/user/info'
                && $request['session_data'] === 'my-session'
                && $request['user_pk'] === '42';
        });
    }

    public function test_get_user_info_by_pk_deactivates_on_login_required(): void {
        Http::fake(['http://python:8001/user/info' => Http::response([
            'error'      => 'Login required',
            'error_code' => 'login_required',
        ], 401)]);

        $this->repo->expects($this->once())->method('deactivateAccount')->with(5);

        $this->service->getUserInfoByPk('session', '42', 5);
    }

    // --- login with device_profile ---

    public function test_login_sends_device_profile_when_provided(): void {
        Http::fake(['http://python:8001/auth/login' => Http::response(['session_data' => '{}'], 200)]);

        $this->service->login('user', 'pass', ['model' => 'Pixel 8']);

        Http::assertSent(function (Request $request) {
            return isset($request['device_profile'])
                && $request['device_profile']['model'] === 'Pixel 8';
        });
    }

    public function test_login_omits_device_profile_when_null(): void {
        Http::fake(['http://python:8001/auth/login' => Http::response(['session_data' => '{}'], 200)]);

        $this->service->login('user', 'pass');

        Http::assertSent(fn (Request $r) => !isset($r['device_profile']));
    }

    // --- fetchCommentReplies ---

    public function test_fetch_comment_replies_sends_required_params(): void {
        Http::fake(['http://python:8001/media/comments/replies' => Http::response([
            'child_comments'       => [],
            'child_comment_count'  => 0,
        ], 200)]);

        $this->service->fetchCommentReplies('session', 1, 'media-pk', 'comment-pk');

        Http::assertSent(function (Request $request) {
            return $request['media_pk'] === 'media-pk'
                && $request['comment_pk'] === 'comment-pk';
        });
    }
}
