<?php

declare(strict_types=1);

namespace App\Services;

interface InstagramClientServiceInterface {
    public function login(string $login, string $password, ?array $deviceProfile = null, ?int $accountId = null, ?int $userId = null): array;
    public function getUserInfo(string $sessionData, ?int $accountId = null, ?int $userId = null): array;
    public function addLike(string $sessionData, string $mediaId, int $accountId, ?int $userId = null): array;
    public function followUser(string $sessionData, string $userPk, int $accountId, ?int $userId = null): array;
    public function unfollowUser(string $sessionData, string $userPk, int $accountId, ?int $userId = null): array;
    public function getFollowing(string $sessionData, int $accountId, int $amount = 50, ?int $userId = null): array;
    public function getFeed(
        string $sessionData,
        int $accountId,
        ?string $maxId = null,
        ?string $seenPosts = null,
        ?string $reason = null,
        ?int $minPosts = null,
        ?int $userId = null
    ): array;
    public function getUserInfoByPk(string $sessionData, string $userPk, int $accountId, ?int $userId = null): array;
    public function searchHashtag(string $sessionData, int $accountId, string $hashtag, int $amount = 30, ?string $nextMaxId = null, ?int $userId = null): array;
    public function searchLocations(string $sessionData, int $accountId, string $query, ?int $userId = null): array;
    public function searchLocationMedias(string $sessionData, int $accountId, int $locationPk, int $amount = 30, ?string $nextMaxId = null, ?int $userId = null): array;
    public function commentMedia(string $sessionData, int $accountId, string $mediaId, string $text, ?int $userId = null): array;
    public function fetchMediaComments(string $sessionData, int $accountId, string $mediaPk, ?string $minId = null, ?int $userId = null): array;
    public function fetchCommentReplies(string $sessionData, int $accountId, string $mediaPk, string $commentPk, ?string $minId = null, ?int $userId = null): array;
    public function parseTargetsCandidates(array $params, ?int $userId = null): array;
    public function parseTargetsEnrich(array $params, ?int $userId = null): array;
    public function getOwnProfile(string $sessionData, ?int $accountId = null, ?int $userId = null): array;
    public function getOwnMedias(string $sessionData, ?string $endCursor = null, int $amount = 12, ?int $accountId = null, ?int $userId = null): array;
    public function getMediaInfo(string $sessionData, string $mediaPk, ?int $accountId = null, ?int $userId = null): array;
}
