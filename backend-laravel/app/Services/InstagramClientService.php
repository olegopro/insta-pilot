<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\InstagramAccountRepositoryInterface;
use Illuminate\Support\Facades\Http;

class InstagramClientService implements InstagramClientServiceInterface {
    public function __construct(
        private readonly string $pythonUrl,
        private readonly ActivityLoggerServiceInterface $activityLogger,
        private readonly InstagramAccountRepositoryInterface $accountRepository,
    ) {}

    public function login(
        string $login,
        string $password,
        ?array $deviceProfile = null,
        ?int $accountId = null,
    ): array {
        $start    = microtime(true);
        $endpoint = '/auth/login';
        $payload  = compact('login', 'password');

        if ($deviceProfile !== null) {
            $payload['device_profile'] = $deviceProfile;
        }

        $response   = Http::post("$this->pythonUrl$endpoint", $payload);
        $durationMs = (int) ((microtime(true) - $start) * 1000);
        $result     = $response->json();
        $isSuccess  = $response->successful();

        if ($accountId !== null) {
            $this->activityLogger->log(
                accountId:       $accountId,
                userId:          (int) auth()->id(),
                action:          'login',
                status:          $isSuccess ? 'success' : $this->detectStatus($result),
                httpCode:        $response->status(),
                endpoint:        $endpoint,
                requestPayload:  [
                    'instagram_login' => $login,
                    'python_request'  => [
                        'endpoint'        => $endpoint,
                        'instagram_login' => $login,
                    ],
                ],
                responseSummary: [
                    'session_restored' => false,
                    'python_response'  => ['http_code' => $response->status()],
                ],
                errorMessage:    $isSuccess ? null : ($result['error'] ?? null),
                errorCode:       $isSuccess ? null : ($result['error_code'] ?? null),
                durationMs:      $durationMs,
            );
        }

        return $result;
    }

    public function getUserInfo(string $sessionData, ?int $accountId = null): array {
        $start    = microtime(true);
        $endpoint = '/account/info';

        $response   = Http::post("$this->pythonUrl$endpoint", ['session_data' => $sessionData]);
        $durationMs = (int) ((microtime(true) - $start) * 1000);
        $result     = $response->json();
        $isSuccess  = $response->successful();

        if ($accountId !== null) {
            $this->activityLogger->log(
                accountId:       $accountId,
                userId:          (int) auth()->id(),
                action:          'fetch_user_info',
                status:          $isSuccess ? 'success' : $this->detectStatus($result),
                httpCode:        $response->status(),
                endpoint:        $endpoint,
                requestPayload:  [
                    'python_request' => ['endpoint' => $endpoint],
                ],
                responseSummary: $isSuccess ? [
                    'followers_count' => $result['followers_count'] ?? null,
                    'following_count' => $result['following_count'] ?? null,
                    'python_response' => [
                        'http_code'       => $response->status(),
                        'followers_count' => $result['followers_count'] ?? null,
                        'following_count' => $result['following_count'] ?? null,
                    ],
                ] : null,
                errorMessage:    $isSuccess ? null : ($result['error'] ?? null),
                errorCode:       $isSuccess ? null : ($result['error_code'] ?? null),
                durationMs:      $durationMs,
            );
        }

        $isSuccess || $this->maybeDeactivateAccount($result, $accountId);

        return $result;
    }

    public function addLike(string $sessionData, string $mediaId, int $accountId): array {
        $start    = microtime(true);
        $endpoint = '/media/like';

        $response   = Http::post("$this->pythonUrl$endpoint", [
            'session_data' => $sessionData,
            'media_id'     => $mediaId,
        ]);
        $durationMs = (int) ((microtime(true) - $start) * 1000);
        $result     = $response->json();
        $isSuccess  = $response->successful();

        $this->activityLogger->log(
            accountId:       $accountId,
            userId:          (int) auth()->id(),
            action:          'like',
            status:          $isSuccess ? 'success' : $this->detectStatus($result),
            httpCode:        $response->status(),
            endpoint:        $endpoint,
            requestPayload:  [
                'media_pk'          => $mediaId,
                'python_request'    => ['endpoint' => $endpoint, 'media_id' => $mediaId],
                'instagram_request' => $result['debug_info']['instagram_request'] ?? null,
            ],
            responseSummary: $isSuccess ? [
                'media_pk'           => $mediaId,
                'python_response'    => ['http_code' => $response->status()],
                'instagram_response' => $result['debug_info']['instagram_response'] ?? null,
            ] : null,
            errorMessage:    $isSuccess ? null : ($result['error'] ?? null),
            errorCode:       $isSuccess ? null : ($result['error_code'] ?? null),
            durationMs:      $durationMs,
        );

        $isSuccess || $this->maybeDeactivateAccount($result, $accountId);

        return $result;
    }

    /**
     * Загрузить страницу ленты Instagram.
     *
     * Python-сервис делает один из двух типов запросов к Instagram:
     *
     *   cold_start_fetch — первая загрузка, без max_id.
     *     Использует стандартный метод instagrapi get_timeline_feed().
     *
     *   pagination — следующие страницы, max_id + seen_posts.
     *     Использует низкоуровневый private_request() напрямую,
     *     потому что get_timeline_feed() не передаёт seen_posts и feed_view_info.
     *     Без этих данных Instagram игнорирует max_id и возвращает те же посты.
     *
     * seen_posts — comma-separated строка media_id в формате pk_{user_pk},
     * накопленная фронтом из всех предыдущих страниц.
     * Python строит из неё feed_view_info (имитация данных просмотра)
     * и передаёт оба поля в тело запроса к Instagram API.
     *
     * @param string      $sessionData  JSON сессии instagrapi (расшифрованный)
     * @param int         $accountId    ID аккаунта для логирования
     * @param string|null $maxId        Курсор следующей страницы из предыдущего ответа
     * @param string|null $seenPosts    Comma-separated media_id просмотренных постов
     */
    public function getFeed(
        string $sessionData,
        int $accountId,
        ?string $maxId = null,
        ?string $seenPosts = null,
        ?string $reason = null,
        ?int $minPosts = null
    ): array {
        $start    = microtime(true);
        $endpoint = '/account/feed';
        $payload  = ['session_data' => $sessionData];

        $maxId !== null && $payload['max_id'] = $maxId;
        $seenPosts !== null && $payload['seen_posts'] = $seenPosts;
        $reason !== null && $payload['reason'] = $reason;
        $minPosts !== null && $payload['min_posts'] = $minPosts;

        $timeout    = $minPosts !== null ? 60 : 15;
        $response   = Http::timeout($timeout)->post("$this->pythonUrl$endpoint", $payload);
        $durationMs = (int) ((microtime(true) - $start) * 1000);
        $result     = $response->json();
        $isSuccess  = $response->successful();

        $seenPostsCount = $seenPosts ? count(array_filter(explode(',', $seenPosts))) : 0;

        $this->activityLogger->log(
            accountId:       $accountId,
            userId:          (int) auth()->id(),
            action:          'fetch_feed',
            status:          $isSuccess ? 'success' : $this->detectStatus($result),
            httpCode:        $response->status(),
            endpoint:        $endpoint,
            requestPayload:  [
                'max_id'            => $maxId,
                'seen_posts_count'  => $seenPostsCount,
                'python_request'    => [
                    'endpoint'         => $endpoint,
                    'max_id'           => $maxId,
                    'seen_posts_count' => $seenPostsCount,
                    'reason'           => $reason,
                ],
                'instagram_request' => $result['debug_info']['instagram_request'] ?? null,
            ],
            responseSummary: $isSuccess ? [
                'items_count'        => count($result['posts'] ?? []),
                'has_more'           => $result['more_available'] ?? false,
                'items_preview'      => array_slice(
                    array_map(
                        fn($post) => [
                            'pk'         => $post['pk'] ?? null,
                            'media_type' => $post['media_type'] ?? null,
                            'username'   => $post['user']['username'] ?? null,
                        ],
                        $result['posts'] ?? []
                    ),
                    0,
                    5
                ),
                'python_response'    => [
                    'http_code'   => $response->status(),
                    'items_count' => count($result['posts'] ?? []),
                    'has_more'    => $result['more_available'] ?? false,
                ],
                'instagram_response' => $result['debug_info']['instagram_response'] ?? null,
            ] : null,
            errorMessage:    $isSuccess ? null : ($result['error'] ?? null),
            errorCode:       $isSuccess ? null : ($result['error_code'] ?? null),
            durationMs:      $durationMs,
        );

        $isSuccess || $this->maybeDeactivateAccount($result, $accountId);

        return $result;
    }

    public function getUserInfoByPk(string $sessionData, string $userPk, int $accountId): array {
        $start    = microtime(true);
        $endpoint = '/user/info';

        $response   = Http::post("$this->pythonUrl$endpoint", [
            'session_data' => $sessionData,
            'user_pk'      => $userPk,
        ]);
        $durationMs = (int) ((microtime(true) - $start) * 1000);
        $result     = $response->json();
        $isSuccess  = $response->successful();

        $this->activityLogger->log(
            accountId:       $accountId,
            userId:          (int) auth()->id(),
            action:          'fetch_user_info',
            status:          $isSuccess ? 'success' : $this->detectStatus($result),
            httpCode:        $response->status(),
            endpoint:        $endpoint,
            requestPayload:  [
                'user_pk'        => $userPk,
                'python_request' => ['endpoint' => $endpoint, 'user_pk' => $userPk],
            ],
            responseSummary: $isSuccess ? [
                'user_pk'         => $userPk,
                'username'        => $result['user']['username'] ?? null,
                'python_response' => [
                    'http_code' => $response->status(),
                    'username'  => $result['user']['username'] ?? null,
                ],
            ] : null,
            errorMessage:    $isSuccess ? null : ($result['error'] ?? null),
            errorCode:       $isSuccess ? null : ($result['error_code'] ?? null),
            durationMs:      $durationMs,
        );

        $isSuccess || $this->maybeDeactivateAccount($result, $accountId);

        return $result;
    }

    public function searchHashtag(string $sessionData, int $accountId, string $hashtag, int $amount = 30, ?string $nextMaxId = null): array {
        $start    = microtime(true);
        $endpoint = '/search/hashtag';
        $payload  = [
            'session_data' => $sessionData,
            'hashtag'      => $hashtag,
            'amount'       => $amount,
        ];

        $nextMaxId !== null && $payload['next_max_id'] = $nextMaxId;

        $response   = Http::timeout(30)->post("$this->pythonUrl$endpoint", $payload);
        $durationMs = (int) ((microtime(true) - $start) * 1000);
        $result     = $response->json();
        $isSuccess  = $response->successful();

        $this->activityLogger->log(
            accountId:       $accountId,
            userId:          (int) auth()->id(),
            action:          'search_hashtag',
            status:          $isSuccess ? 'success' : $this->detectStatus($result),
            httpCode:        $response->status(),
            endpoint:        $endpoint,
            requestPayload:  [
                'hashtag'           => $hashtag,
                'amount'            => $amount,
                'python_request'    => [
                    'endpoint'    => $endpoint,
                    'hashtag'     => $hashtag,
                    'amount'      => $amount,
                    'next_max_id' => $nextMaxId,
                ],
                'instagram_request' => $result['debug_info']['instagram_request'] ?? null,
            ],
            responseSummary: $isSuccess ? [
                'results_count'      => count($result['items'] ?? []),
                'items_preview'      => array_slice(
                    array_map(
                        fn($item) => [
                            'pk'         => $item['pk'] ?? null,
                            'code'       => $item['code'] ?? null,
                            'username'   => $item['user']['username'] ?? null,
                            'likes'      => $item['like_count'] ?? null,
                            'media_type' => $item['media_type'] ?? null,
                        ],
                        $result['items'] ?? []
                    ),
                    0,
                    5
                ),
                'python_response'    => [
                    'http_code'     => $response->status(),
                    'results_count' => count($result['items'] ?? []),
                ],
                'instagram_response' => $result['debug_info']['instagram_response'] ?? null,
            ] : null,
            errorMessage:    $isSuccess ? null : ($result['error'] ?? null),
            errorCode:       $isSuccess ? null : ($result['error_code'] ?? null),
            durationMs:      $durationMs,
        );

        $isSuccess || $this->maybeDeactivateAccount($result, $accountId);

        return $result;
    }

    public function searchLocations(string $sessionData, int $accountId, string $query): array {
        $start    = microtime(true);
        $endpoint = '/search/locations';

        $response   = Http::post("$this->pythonUrl$endpoint", [
            'session_data' => $sessionData,
            'query'        => $query,
        ]);
        $durationMs = (int) ((microtime(true) - $start) * 1000);
        $result     = $response->json();
        $isSuccess  = $response->successful();

        $this->activityLogger->log(
            accountId:       $accountId,
            userId:          (int) auth()->id(),
            action:          'search_locations',
            status:          $isSuccess ? 'success' : $this->detectStatus($result),
            httpCode:        $response->status(),
            endpoint:        $endpoint,
            requestPayload:  [
                'query'             => $query,
                'python_request'    => ['endpoint' => $endpoint, 'query' => $query],
                'instagram_request' => $result['debug_info']['instagram_request'] ?? null,
            ],
            responseSummary: $isSuccess ? [
                'results_count'      => count($result['locations'] ?? []),
                'locations_preview'  => array_slice(
                    array_map(
                        fn($location) => [
                            'pk'   => $location['pk'] ?? null,
                            'name' => $location['name'] ?? null,
                        ],
                        $result['locations'] ?? []
                    ),
                    0,
                    5
                ),
                'python_response'    => [
                    'http_code'     => $response->status(),
                    'results_count' => count($result['locations'] ?? []),
                ],
                'instagram_response' => $result['debug_info']['instagram_response'] ?? null,
            ] : null,
            errorMessage:    $isSuccess ? null : ($result['error'] ?? null),
            errorCode:       $isSuccess ? null : ($result['error_code'] ?? null),
            durationMs:      $durationMs,
        );

        $isSuccess || $this->maybeDeactivateAccount($result, $accountId);

        return $result;
    }

    public function searchLocationMedias(string $sessionData, int $accountId, int $locationPk, int $amount = 30, ?string $nextMaxId = null): array {
        $start    = microtime(true);
        $endpoint = '/search/location';
        $payload  = [
            'session_data' => $sessionData,
            'location_pk'  => $locationPk,
            'amount'       => $amount,
        ];

        $nextMaxId !== null && $payload['next_max_id'] = $nextMaxId;

        $response   = Http::timeout(30)->post("$this->pythonUrl$endpoint", $payload);
        $durationMs = (int) ((microtime(true) - $start) * 1000);
        $result     = $response->json();
        $isSuccess  = $response->successful();

        $this->activityLogger->log(
            accountId:       $accountId,
            userId:          (int) auth()->id(),
            action:          'search_location_medias',
            status:          $isSuccess ? 'success' : $this->detectStatus($result),
            httpCode:        $response->status(),
            endpoint:        $endpoint,
            requestPayload:  [
                'location_pk'       => $locationPk,
                'amount'            => $amount,
                'python_request'    => [
                    'endpoint'    => $endpoint,
                    'location_pk' => $locationPk,
                    'amount'      => $amount,
                    'next_max_id' => $nextMaxId,
                ],
                'instagram_request' => $result['debug_info']['instagram_request'] ?? null,
            ],
            responseSummary: $isSuccess ? [
                'results_count'      => count($result['items'] ?? []),
                'items_preview'      => array_slice(
                    array_map(
                        fn($item) => [
                            'pk'         => $item['pk'] ?? null,
                            'code'       => $item['code'] ?? null,
                            'username'   => $item['user']['username'] ?? null,
                            'likes'      => $item['like_count'] ?? null,
                            'media_type' => $item['media_type'] ?? null,
                        ],
                        $result['items'] ?? []
                    ),
                    0,
                    5
                ),
                'python_response'    => [
                    'http_code'     => $response->status(),
                    'results_count' => count($result['items'] ?? []),
                ],
                'instagram_response' => $result['debug_info']['instagram_response'] ?? null,
            ] : null,
            errorMessage:    $isSuccess ? null : ($result['error'] ?? null),
            errorCode:       $isSuccess ? null : ($result['error_code'] ?? null),
            durationMs:      $durationMs,
        );

        $isSuccess || $this->maybeDeactivateAccount($result, $accountId);

        return $result;
    }

    public function commentMedia(string $sessionData, int $accountId, string $mediaId, string $text): array {
        $start    = microtime(true);
        $endpoint = '/media/comment';

        $response   = Http::post("$this->pythonUrl$endpoint", [
            'session_data' => $sessionData,
            'media_id'     => $mediaId,
            'text'         => $text,
        ]);
        $durationMs = (int) ((microtime(true) - $start) * 1000);
        $result     = $response->json();
        $isSuccess  = $response->successful();

        $this->activityLogger->log(
            accountId:       $accountId,
            userId:          (int) auth()->id(),
            action:          'comment',
            status:          $isSuccess ? 'success' : $this->detectStatus($result),
            httpCode:        $response->status(),
            endpoint:        $endpoint,
            requestPayload:  [
                'media_pk'          => $mediaId,
                'text'              => $text,
                'text_length'       => mb_strlen($text),
                'python_request'    => [
                    'endpoint'    => $endpoint,
                    'media_id'    => $mediaId,
                    'text_length' => mb_strlen($text),
                ],
                'instagram_request' => $result['debug_info']['instagram_request'] ?? null,
            ],
            responseSummary: $isSuccess ? [
                'media_pk'           => $mediaId,
                'comment_pk'         => $result['comment_pk'] ?? null,
                'python_response'    => [
                    'http_code'  => $response->status(),
                    'comment_pk' => $result['comment_pk'] ?? null,
                ],
                'instagram_response' => $result['debug_info']['instagram_response'] ?? null,
            ] : null,
            errorMessage:    $isSuccess ? null : ($result['error'] ?? null),
            errorCode:       $isSuccess ? null : ($result['error_code'] ?? null),
            durationMs:      $durationMs,
        );

        $isSuccess || $this->maybeDeactivateAccount($result, $accountId);

        return $result;
    }

    public function fetchMediaComments(string $sessionData, int $accountId, string $mediaPk, ?string $minId = null): array {
        $start    = microtime(true);
        $endpoint = '/media/comments';
        $payload  = ['session_data' => $sessionData, 'media_pk' => $mediaPk];
        $minId !== null && $payload['min_id'] = $minId;

        $response   = Http::timeout(20)->post("$this->pythonUrl$endpoint", $payload);
        $durationMs = (int) ((microtime(true) - $start) * 1000);
        $result     = $response->json();
        $isSuccess  = $response->successful();

        $this->activityLogger->log(
            accountId:       $accountId,
            userId:          (int) auth()->id(),
            action:          'fetch_comments',
            status:          $isSuccess ? 'success' : $this->detectStatus($result),
            httpCode:        $response->status(),
            endpoint:        $endpoint,
            requestPayload:  [
                'media_pk'       => $mediaPk,
                'min_id'         => $minId,
                'python_request' => ['endpoint' => $endpoint, 'media_pk' => $mediaPk],
            ],
            responseSummary: $isSuccess ? [
                'comment_count'     => $result['comment_count'] ?? 0,
                'returned'          => count($result['comments'] ?? []),
                'has_more'          => $result['next_min_id'] !== null,
                'python_response'   => ['http_code' => $response->status(), 'returned' => count($result['comments'] ?? [])],
            ] : null,
            errorMessage:    $isSuccess ? null : ($result['error'] ?? null),
            errorCode:       $isSuccess ? null : ($result['error_code'] ?? null),
            durationMs:      $durationMs,
        );

        return $result;
    }

    public function fetchCommentReplies(string $sessionData, int $accountId, string $mediaPk, string $commentPk, ?string $minId = null): array {
        $start    = microtime(true);
        $endpoint = '/media/comments/replies';
        $payload  = ['session_data' => $sessionData, 'media_pk' => $mediaPk, 'comment_pk' => $commentPk];
        $minId !== null && $payload['min_id'] = $minId;

        $response   = Http::timeout(20)->post("$this->pythonUrl$endpoint", $payload);
        $durationMs = (int) ((microtime(true) - $start) * 1000);
        $result     = $response->json();
        $isSuccess  = $response->successful();

        $this->activityLogger->log(
            accountId:       $accountId,
            userId:          (int) auth()->id(),
            action:          'fetch_comment_replies',
            status:          $isSuccess ? 'success' : $this->detectStatus($result),
            httpCode:        $response->status(),
            endpoint:        $endpoint,
            requestPayload:  [
                'media_pk'       => $mediaPk,
                'comment_pk'     => $commentPk,
                'python_request' => ['endpoint' => $endpoint, 'media_pk' => $mediaPk, 'comment_pk' => $commentPk],
            ],
            responseSummary: $isSuccess ? [
                'child_comment_count' => $result['child_comment_count'] ?? 0,
                'returned'            => count($result['child_comments'] ?? []),
                'python_response'     => ['http_code' => $response->status(), 'returned' => count($result['child_comments'] ?? [])],
            ] : null,
            errorMessage:    $isSuccess ? null : ($result['error'] ?? null),
            errorCode:       $isSuccess ? null : ($result['error_code'] ?? null),
            durationMs:      $durationMs,
        );

        return $result;
    }

    private function detectStatus(array $result): string {
        $code = $result['error_code'] ?? null;

        return match ($code) {
            'rate_limited'       => 'rate_limited',
            'challenge_required' => 'challenge_required',
            'login_required'     => 'login_required',
            'timeout'            => 'timeout',
            default              => 'error',
        };
    }

    private function maybeDeactivateAccount(array $result, ?int $accountId): void {
        if ($accountId === null) {
            return;
        }

        $code = $result['error_code'] ?? null;

        if ($code === 'login_required' || $code === 'challenge_required') {
            $this->accountRepository->deactivateAccount($accountId);
        }
    }
}
