<?php

declare(strict_types=1);

namespace Tests\Feature\ProxyImage;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ProxyImageTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();

        // Перенаправляем file-кеш на array (in-memory), чтобы тесты изолировать
        config(['cache.stores.file' => ['driver' => 'array']]);
        Cache::forgetDriver('file');
    }

    public function test_returns_image_with_correct_content_type(): void {
        Http::fake([
            'cdninstagram.com/*' => Http::response('fake-image-bytes', 200, [
                'Content-Type' => 'image/jpeg',
            ]),
        ]);

        $this->getJson('/api/proxy/image?url=https://cdninstagram.com/photo.jpg')
            ->assertStatus(200)
            ->assertHeader('Content-Type', 'image/jpeg');
    }

    public function test_caches_image_on_second_request(): void {
        Http::fake([
            'cdninstagram.com/*' => Http::response('fake-image-bytes', 200, [
                'Content-Type' => 'image/jpeg',
            ]),
        ]);

        $url = 'https://cdninstagram.com/cached-photo.jpg';

        $this->call('GET', '/api/proxy/image', ['url' => $url]);
        $this->call('GET', '/api/proxy/image', ['url' => $url]);

        Http::assertSentCount(1);
    }

    public function test_returns_403_for_disallowed_domain(): void {
        $this->call('GET', '/api/proxy/image', ['url' => 'https://evil.com/photo.jpg'])
            ->assertStatus(403);
    }

    public function test_returns_403_when_no_url(): void {
        $this->call('GET', '/api/proxy/image')
            ->assertStatus(403);
    }

    public function test_returns_404_when_cdn_fails(): void {
        Http::fake([
            'cdninstagram.com/*' => Http::response('', 404),
        ]);

        $this->call('GET', '/api/proxy/image', ['url' => 'https://cdninstagram.com/missing.jpg'])
            ->assertStatus(404);
    }

    public function test_public_route_no_auth_required(): void {
        Http::fake([
            'fbcdn.net/*' => Http::response('image-data', 200, ['Content-Type' => 'image/png']),
        ]);

        // Без actingAs — должен вернуть 200, не 401
        $this->call('GET', '/api/proxy/image', ['url' => 'https://scontent.fbcdn.net/img.png'])
            ->assertStatus(200);
    }
}
