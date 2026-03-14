<?php

declare(strict_types=1);

namespace App\Services;

interface InstagramClientServiceInterface {
    public function login(string $login, string $password, ?string $proxy = null): array;
    public function getUserInfo(string $sessionData): array;
    public function addLike(string $sessionData, string $mediaId): array;
    public function getFeed(string $sessionData, ?string $maxId = null, ?string $seenPosts = null, ?string $reason = null): array;
    public function getUserInfoByPk(string $sessionData, string $userPk): array;
}
