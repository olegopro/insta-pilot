<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;

readonly class InstagramClientService implements InstagramClientServiceInterface {
    public function __construct(private string $pythonUrl) {}

    public function login(
        string $login,
        string $password,
        ?string $proxy = null
    ): array {
        return Http::post(
            "$this->pythonUrl/auth/login",
            compact('login', 'password', 'proxy')
        )->json();
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
        ?string $reason = null
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

        return Http::post("$this->pythonUrl/account/feed", $payload)->json();
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
}
