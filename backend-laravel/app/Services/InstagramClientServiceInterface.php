<?php

declare(strict_types=1);

namespace App\Services;

interface InstagramClientServiceInterface {
    public function login(string $login, string $password, ?string $proxy = null): array;
    public function getUserInfo(string $sessionData): array;
    public function addLike(string $sessionData, string $mediaId): array;
}