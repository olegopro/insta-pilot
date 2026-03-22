<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Repositories\InstagramAccountRepositoryInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;

final class ProxyMediaController extends Controller {
    private const ALLOWED_DOMAINS = [
        'cdninstagram.com',
        'fbcdn.net'
    ];

    public function __construct(
        private readonly InstagramAccountRepositoryInterface $accountRepository
    ) {}

    /**
     * Проксирование медиа-контента с учётом proxy аккаунта.
     * GET /api/proxy/media/{accountId}?url=...
     *
     * Если у аккаунта нет прокси — возвращает X-Accel-Redirect:
     *   Nginx сам стримит байты с CDN (прогрессивный JPEG, без буферизации PHP).
     * Если прокси задан — PHP скачивает через него и буферизует ответ.
     */
    public function show(int $accountId, Request $request): Response {
        $url = $request->query('url');

        if (!$url || !$this->isAllowedDomain($url)) {
            return response('', 403);
        }

        $account = $this->accountRepository->findById($accountId);

        if (!$account) {
            return response('', 404);
        }

        // Без прокси — Nginx проксирует напрямую через X-Accel-Redirect
        if (!$account->proxy) {
            return $this->accelRedirect($url);
        }

        // С прокси — PHP качает через него (Nginx не умеет динамически менять прокси)
        $httpResponse = Http::timeout(15)->withOptions(['proxy' => $account->proxy])->get($url);

        if (!$httpResponse->successful()) {
            return response('', 404);
        }

        $body        = $httpResponse->body();
        $contentType = $httpResponse->header('Content-Type') ?? 'image/jpeg';

        return response($body)
            ->header('Content-Type', $contentType)
            ->header('Cache-Control', 'public, max-age=604800');
    }

    /**
     * Проксирование аватарок (без привязки к аккаунту, без proxy).
     * GET /api/proxy/avatar?url=...
     *
     * Всегда через X-Accel-Redirect — аватарки не требуют прокси аккаунта.
     */
    public function avatar(Request $request): Response {
        $url = $request->query('url');

        if (!$url || !$this->isAllowedDomain($url)) {
            return response('', 403);
        }

        return $this->accelRedirect($url);
    }

    /**
     * Возвращает пустой 200-ответ с X-Accel-Redirect + X-CDN-URL.
     * Nginx перехватывает X-Accel-Redirect и проксирует CDN напрямую.
     *
     * URL передаётся через заголовок X-CDN-URL (не через query-param) — иначе Nginx
     * не декодирует $arg_url и proxy_pass получает "https%3A%2F%2F..." → ошибка.
     *
     * ck (cache key) — стабильный идентификатор контента:
     *   - ig_cache_key из CDN URL (BASE64-хэш файла, не меняется при смене oh=/oe=)
     *   - fallback: host + path без ephemeral query-параметров
     */
    private function accelRedirect(string $url): Response {
        $cacheKey = $this->extractCacheKey($url);

        return response('')
            ->header('X-Accel-Redirect', '/internal/cdn-proxy/?ck=' . rawurlencode($cacheKey))
            ->header('X-CDN-URL', $url);
    }

    /**
     * Извлекает стабильный ключ кэша из CDN URL.
     * ig_cache_key — BASE64-хэш файла, не зависит от подписанных параметров (oh=, oe=).
     */
    private function extractCacheKey(string $url): string {
        $parsed = parse_url($url);
        $query  = $parsed['query'] ?? '';

        if (preg_match('/ig_cache_key=([^&]+)/', $query, $matches)) {
            return urldecode($matches[1]);
        }

        // Fallback для аватарок без ig_cache_key: host + path без ephemeral query
        return ($parsed['host'] ?? '') . ($parsed['path'] ?? '');
    }

    private function isAllowedDomain(string $url): bool {
        $host = parse_url($url, PHP_URL_HOST);

        if (!$host) {
            return false;
        }

        foreach (self::ALLOWED_DOMAINS as $domain) {
            if (str_ends_with($host, $domain)) {
                return true;
            }
        }

        return false;
    }
}
