<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

final class ProxyImageController extends Controller {
    private const array ALLOWED_DOMAINS = [
        'cdninstagram.com',
        'fbcdn.net'
    ];

    private const int CACHE_TTL_HOURS = 23;

    public function show(Request $request): Response {
        $url = $request->query('url');

        if (!$url || !$this->isAllowedDomain($url)) {
            return response('', 403);
        }

        $cacheKey = 'proxy_image_' . sha1((string) parse_url($url, PHP_URL_PATH));
        $store    = Cache::store('file');
        $cached   = $store->get($cacheKey);

        if ($cached !== null) {
            return response($cached['body'])
                ->header('Content-Type', $cached['content_type'])
                ->header('Cache-Control', 'public, max-age=82800');
        }

        $httpResponse = Http::timeout(10)->get($url);

        if (!$httpResponse->successful()) {
            return response('', 404);
        }

        $body        = $httpResponse->body();
        $contentType = $httpResponse->header('Content-Type') ?? 'image/jpeg';

        $store->put($cacheKey, [
            'body'         => $body,
            'content_type' => $contentType,
        ], now()->addHours(self::CACHE_TTL_HOURS));

        return response($body)
            ->header('Content-Type', $contentType)
            ->header('Cache-Control', 'public, max-age=82800');
    }

    private function isAllowedDomain(string $url): bool {
        $host = parse_url($url, PHP_URL_HOST);

        if (!$host) {
            return false;
        }

        foreach (self::ALLOWED_DOMAINS as $domain) {
            if ($host === $domain || str_ends_with($host, '.' . $domain)) {
                return true;
            }
        }

        return false;
    }
}
