<?php

declare(strict_types=1);

namespace App\Services\Automation;

final class TargetFilterService implements TargetFilterServiceInterface {
    public function applyFilters(array $enriched, array $filters): array {
        $results = [];

        foreach ($enriched as $target) {
            $results[] = $this->evaluate($target, $filters);
        }

        return $results;
    }

    /**
     * @param array<string, mixed> $target
     * @param array<string, mixed> $filters
     * @return array{target: array<string, mixed>, passed: bool, reason?: string}
     */
    private function evaluate(array $target, array $filters): array {
        $user    = is_array($target['user'] ?? null) ? $target['user'] : [];
        $metrics = is_array($target['metrics'] ?? null) ? $target['metrics'] : [];

        $reason = $this->firstFailure($user, $metrics, $filters);

        if ($reason !== null) {
            return [
                'target' => $target,
                'passed' => false,
                'reason' => $reason
            ];
        }

        return [
            'target' => $target,
            'passed' => true
        ];
    }

    /**
     * @param array<string, mixed> $user
     * @param array<string, mixed> $metrics
     * @param array<string, mixed> $filters
     */
    private function firstFailure(array $user, array $metrics, array $filters): ?string {
        $followers = (int) ($user['follower_count'] ?? 0);
        $following = (int) ($user['following_count'] ?? 0);

        if ($this->belowMin($followers, $filters['followers_min'] ?? null)) {
            return 'followers_min';
        }

        if ($this->aboveMax($followers, $filters['followers_max'] ?? null)) {
            return 'followers_max';
        }

        if ($this->belowMin($following, $filters['following_min'] ?? null)) {
            return 'following_min';
        }

        if ($this->aboveMax($following, $filters['following_max'] ?? null)) {
            return 'following_max';
        }

        $maxAge = $filters['last_post_age_days'] ?? null;

        if ($maxAge !== null && $maxAge !== '') {
            $age = $metrics['last_post_age_days'] ?? null;

            if ($age === null || (int) $age > (int) $maxAge) {
                return 'last_post_age_days';
            }
        }

        $likesSum = (int) ($metrics['likes_sum_last_n'] ?? 0);
        $likesAvg = (float) ($metrics['likes_avg_last_n'] ?? 0);

        if ($this->belowMin($likesSum, $filters['likes_sum_min'] ?? null)) {
            return 'likes_sum_min';
        }

        if ($this->aboveMax($likesSum, $filters['likes_sum_max'] ?? null)) {
            return 'likes_sum_max';
        }

        if ($this->belowMin($likesAvg, $filters['likes_avg_min'] ?? null)) {
            return 'likes_avg_min';
        }

        if ($this->aboveMax($likesAvg, $filters['likes_avg_max'] ?? null)) {
            return 'likes_avg_max';
        }

        $haystack = $this->buildHaystack($user, $metrics);

        $whitelist = $this->words($filters['whitelist'] ?? null);

        if ($whitelist !== [] && !$this->containsAny($haystack, $whitelist)) {
            return 'whitelist';
        }

        $blacklist = $this->words($filters['blacklist'] ?? null);

        if ($blacklist !== [] && $this->containsAny($haystack, $blacklist)) {
            return 'blacklist';
        }

        return null;
    }

    private function belowMin(int | float $value, mixed $min): bool {
        return $min !== null && $min !== '' && $value < (float) $min;
    }

    private function aboveMax(int | float $value, mixed $max): bool {
        return $max !== null && $max !== '' && $value > (float) $max;
    }

    /**
     * @param array<string, mixed> $user
     * @param array<string, mixed> $metrics
     */
    private function buildHaystack(array $user, array $metrics): string {
        $biography = is_string($user['biography'] ?? null) ? $user['biography'] : '';
        $captions  = is_string($metrics['captions_concat'] ?? null) ? $metrics['captions_concat'] : '';

        return mb_strtolower(trim($biography . "\n" . $captions));
    }

    /**
     * @param mixed $value
     * @return array<int, string>
     */
    private function words(mixed $value): array {
        $items = is_array($value) ? $value : [];
        $words = [];

        foreach ($items as $word) {
            if (!is_string($word)) {
                continue;
            }

            $normalized = mb_strtolower(trim($word));
            $normalized !== '' && $words[] = $normalized;
        }

        return $words;
    }

    /**
     * @param array<int, string> $words
     */
    private function containsAny(string $haystack, array $words): bool {
        foreach ($words as $word) {
            if (mb_strpos($haystack, $word) !== false) {
                return true;
            }
        }

        return false;
    }
}
