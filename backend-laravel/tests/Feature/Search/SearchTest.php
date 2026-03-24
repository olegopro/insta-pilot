<?php

declare(strict_types=1);

namespace Tests\Feature\Search;

use App\Models\InstagramAccount;
use App\Models\User;
use App\Services\InstagramClientServiceInterface;
use Tests\TestCase;

class SearchTest extends TestCase {
    private User $user;
    private InstagramAccount $account;
    private string $sessionData = '{"uuids":{},"cookies":{},"last_login":0,"device_settings":{},"user_agent":"","country":"US","country_code":1,"locale":"en_US","timezone_offset":0,"authorization_data":{}}';

    protected function setUp(): void {
        parent::setUp();
        $this->user    = User::factory()->create();
        $this->account = InstagramAccount::factory()->create([
            'user_id'      => $this->user->id,
            'session_data' => $this->sessionData,
        ]);
    }

    // --- Hashtag ---

    public function test_hashtag_returns_items(): void {
        $this->mock(InstagramClientServiceInterface::class)
            ->shouldReceive('searchHashtag')
            ->andReturn([
                'success'     => true,
                'items'       => [['pk' => '111', 'code' => 'abc123']],
                'next_max_id' => 'cursor-1',
            ]);

        $this->actingAs($this->user)
            ->getJson("/api/search/hashtag?account_id={$this->account->id}&tag=travel")
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.items.0.pk', '111')
            ->assertJsonPath('data.next_max_id', 'cursor-1');
    }

    public function test_hashtag_pagination(): void {
        $mock = $this->mock(InstagramClientServiceInterface::class);
        $mock->shouldReceive('searchHashtag')
            ->withArgs(fn ($s, $id, $tag, $amount, $cursor) => $cursor === 'cursor-page2')
            ->andReturn(['success' => true, 'items' => [], 'next_max_id' => null]);

        $this->actingAs($this->user)
            ->getJson("/api/search/hashtag?account_id={$this->account->id}&tag=travel&next_max_id=cursor-page2")
            ->assertStatus(200);
    }

    public function test_hashtag_requires_tag(): void {
        $this->actingAs($this->user)
            ->getJson("/api/search/hashtag?account_id={$this->account->id}")
            ->assertStatus(422);
    }

    // --- Locations ---

    public function test_locations_returns_list(): void {
        $this->mock(InstagramClientServiceInterface::class)
            ->shouldReceive('searchLocations')
            ->andReturn([
                'success'   => true,
                'locations' => [
                    ['pk' => 1001, 'name' => 'Red Square'],
                    ['pk' => 1002, 'name' => 'Kremlin'],
                ],
            ]);

        $this->actingAs($this->user)
            ->getJson("/api/search/locations?account_id={$this->account->id}&query=Moscow")
            ->assertStatus(200)
            ->assertJsonPath('data.locations.0.name', 'Red Square');
    }

    // --- Location medias ---

    public function test_location_medias_returns_items(): void {
        $this->mock(InstagramClientServiceInterface::class)
            ->shouldReceive('searchLocationMedias')
            ->andReturn([
                'success'     => true,
                'items'       => [['pk' => '333', 'media_type' => 1]],
                'next_max_id' => null,
            ]);

        $this->actingAs($this->user)
            ->getJson("/api/search/location?account_id={$this->account->id}&location_pk=1001")
            ->assertStatus(200)
            ->assertJsonPath('data.items.0.pk', '333');
    }

    // --- Auth / ownership ---

    public function test_returns_404_for_other_users_account(): void {
        $other   = User::factory()->create();
        $account = InstagramAccount::factory()->create(['user_id' => $other->id]);

        $this->actingAs($this->user)
            ->getJson("/api/search/hashtag?account_id={$account->id}&tag=travel")
            ->assertStatus(404);
    }

    public function test_requires_auth(): void {
        $this->getJson("/api/search/hashtag?account_id={$this->account->id}&tag=travel")
            ->assertStatus(401);
    }

    public function test_inactive_user_gets_403(): void {
        $inactive = User::factory()->inactive()->create();
        $account  = InstagramAccount::factory()->create(['user_id' => $inactive->id]);

        $this->actingAs($inactive)
            ->getJson("/api/search/hashtag?account_id={$account->id}&tag=travel")
            ->assertStatus(403);
    }
}
