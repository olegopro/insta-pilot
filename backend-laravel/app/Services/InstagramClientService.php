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
            ['session_data' => $sessionData, 'media_id' => $mediaId]
        )->json();
    }

}
