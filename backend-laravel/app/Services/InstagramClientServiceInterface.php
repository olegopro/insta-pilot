<?php

declare(strict_types=1);

namespace App\Services;

interface InstagramClientServiceInterface {
    public function login(string $login, string $password, ?array $deviceProfile = null, ?int $accountId = null): array;
    public function getUserInfo(string $sessionData, ?int $accountId = null): array;
    public function addLike(string $sessionData, string $mediaId, int $accountId): array;
    public function getFeed(
        string $sessionData,
        int $accountId,
        ?string $maxId = null,
        ?string $seenPosts = null,
        ?string $reason = null,
        ?int $minPosts = null
    ): array;
    public function getUserInfoByPk(string $sessionData, string $userPk, int $accountId): array;
    public function searchHashtag(string $sessionData, int $accountId, string $hashtag, int $amount = 30, ?string $nextMaxId = null): array;
    public function searchLocations(string $sessionData, int $accountId, string $query): array;
    public function searchLocationMedias(string $sessionData, int $accountId, int $locationPk, int $amount = 30, ?string $nextMaxId = null): array;
    public function commentMedia(string $sessionData, int $accountId, string $mediaId, string $text): array;
    public function fetchMediaComments(string $sessionData, int $accountId, string $mediaPk, ?string $minId = null): array;
    public function fetchCommentReplies(string $sessionData, int $accountId, string $mediaPk, string $commentPk, ?string $minId = null): array;
}
