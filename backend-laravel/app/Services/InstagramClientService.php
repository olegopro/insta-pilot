<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;

readonly class InstagramClientService implements InstagramClientServiceInterface {
    public function __construct(private string $pythonUrl) {}

    public function login(string $login, string $password, ?string $proxy = null): array {
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

    public function getFeed(string $sessionData, ?string $maxId = null): array {
        $payload = ['session_data' => $sessionData];
        if ($maxId !== null) {
            $payload['max_id'] = $maxId;
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
