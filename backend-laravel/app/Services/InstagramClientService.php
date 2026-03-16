<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;

readonly class InstagramClientService implements InstagramClientServiceInterface {
    public function __construct(private string $pythonUrl) {}

    public function login(
        string $login,
        string $password,
        ?string $proxy = null,
        ?array $deviceProfile = null
    ): array {
        $payload = compact('login', 'password', 'proxy');

        if ($deviceProfile !== null) {
            $payload['device_profile'] = $deviceProfile;
        }

        return Http::post("$this->pythonUrl/auth/login", $payload)->json();
    }

    public function getUserInfo(string $sessionData): array {
        return Http::post(
            "$this->pythonUrl/account/info",
            ['session_data' => $sessionData]
        )->json();
    }

    public function addLike(string $sessionData, string $mediaId): array {
        return Http::post(
            "$this->pythonUrl/media/like",
            [
                'session_data' => $sessionData,
                'media_id'     => $mediaId
            ]
        )->json();
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
     * @param string|null $maxId        Курсор следующей страницы из предыдущего ответа
     * @param string|null $seenPosts    Comma-separated media_id просмотренных постов
     */
    public function getFeed(
        string $sessionData,
        ?string $maxId = null,
        ?string $seenPosts = null,
        ?string $reason = null,
        ?int $minPosts = null
    ): array {
        $payload = ['session_data' => $sessionData];

        if ($maxId !== null) {
            $payload['max_id'] = $maxId;
        }

        if ($seenPosts !== null) {
            $payload['seen_posts'] = $seenPosts;
        }

        if ($reason !== null) {
            $payload['reason'] = $reason;
        }

        if ($minPosts !== null) {
            $payload['min_posts'] = $minPosts;
        }

        $timeout = $minPosts !== null ? 60 : 15;

        return Http::timeout($timeout)->post("$this->pythonUrl/account/feed", $payload)->json();
    }

    public function getUserInfoByPk(string $sessionData, string $userPk): array {
        return Http::post(
            "$this->pythonUrl/user/info",
            [
                'session_data' => $sessionData,
                'user_pk'      => $userPk
            ]
        )->json();
    }

    public function searchHashtag(string $sessionData, string $hashtag, int $amount = 30, ?string $nextMaxId = null): array {
        $payload = [
            'session_data' => $sessionData,
            'hashtag'      => $hashtag,
            'amount'       => $amount
        ];

        if ($nextMaxId !== null) {
            $payload['next_max_id'] = $nextMaxId;
        }

        return Http::timeout(30)->post("$this->pythonUrl/search/hashtag", $payload)->json();
    }

    public function searchLocations(string $sessionData, string $query): array {
        return Http::post(
            "$this->pythonUrl/search/locations",
            [
                'session_data' => $sessionData,
                'query'        => $query
            ]
        )->json();
    }

    public function searchLocationMedias(string $sessionData, int $locationPk, int $amount = 30, ?string $nextMaxId = null): array {
        $payload = [
            'session_data' => $sessionData,
            'location_pk'  => $locationPk,
            'amount'       => $amount
        ];

        if ($nextMaxId !== null) {
            $payload['next_max_id'] = $nextMaxId;
        }

        return Http::timeout(30)->post("$this->pythonUrl/search/location", $payload)->json();
    }

    public function commentMedia(string $sessionData, string $mediaId, string $text): array {
        return Http::post(
            "$this->pythonUrl/media/comment",
            [
                'session_data' => $sessionData,
                'media_id'     => $mediaId,
                'text'         => $text
            ]
        )->json();
    }
}
