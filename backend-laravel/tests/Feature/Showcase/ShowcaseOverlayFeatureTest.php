<?php

declare(strict_types=1);

namespace Tests\Feature\Showcase;

use App\Models\InstagramAccount;
use App\Models\ShowcaseMediaOverlay;
use App\Models\User;
use Tests\TestCase;

/**
 * Feature-тесты записи overlay Витрины (Phase 2) — границы авторизации
 * (401/403/404/ownership) и валидация payload.
 *
 * ВНИМАНИЕ: требует роутов /api/showcase/{account}/media/{mediaPk}/overlay
 * (PATCH) и /api/showcase/{account}/board/order (POST), которые добавляет
 * оркестратор (routes/api.php правит параллельная задача). До их появления
 * НЕ запускать.
 *
 * Пути роутов ниже — ОЖИДАЕМЫЕ (assumption), синхронизировать с routes/api.php
 * после их добавления оркестратором.
 */
class ShowcaseOverlayFeatureTest extends TestCase {
    private User $user;
    private InstagramAccount $account;

    protected function setUp(): void {
        parent::setUp();
        $this->user    = User::factory()->create();
        $this->account = InstagramAccount::factory()->create([
            'user_id'      => $this->user->id,
            'session_data' => '{"uuids":{},"cookies":{}}'
        ]);
    }

    public function test_update_overlay_persists_flags_and_returns_contract_shape(): void {
        $this->actingAs($this->user)
            ->patchJson("/api/showcase/{$this->account->id}/media/111/overlay", [
                'is_ad'  => true,
                'note'   => 'sponsored',
                'labels' => ['promo']
            ])
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.is_ad', true)
            ->assertJsonPath('data.note', 'sponsored')
            ->assertJsonPath('data.labels.0', 'promo')
            ->assertJsonPath('data.board_position', null);

        $this->assertDatabaseHas('showcase_media_overlays', [
            'instagram_account_id' => $this->account->id,
            'media_pk'             => '111',
            'is_ad'                => true
        ]);
    }

    public function test_update_overlay_returns_404_for_other_users_account(): void {
        $other   = User::factory()->create();
        $account = InstagramAccount::factory()->create(['user_id' => $other->id]);

        $this->actingAs($this->user)
            ->patchJson("/api/showcase/{$account->id}/media/111/overlay", ['is_ad' => true])
            ->assertStatus(404);

        $this->assertDatabaseMissing('showcase_media_overlays', ['media_pk' => '111']);
    }

    public function test_update_overlay_validates_types(): void {
        $this->actingAs($this->user)
            ->patchJson("/api/showcase/{$this->account->id}/media/111/overlay", [
                'is_ad'  => 'not-a-bool',
                'labels' => 'not-an-array'
            ])
            ->assertStatus(422);
    }

    public function test_update_overlay_requires_auth(): void {
        $this->patchJson("/api/showcase/{$this->account->id}/media/111/overlay", ['is_ad' => true])
            ->assertStatus(401);
    }

    public function test_reorder_board_sets_positions(): void {
        $this->actingAs($this->user)
            ->putJson("/api/showcase/{$this->account->id}/board/order", [
                'order' => [
                    ['media_pk' => '111', 'position' => 0],
                    ['media_pk' => '222', 'position' => 1]
                ]
            ])
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('showcase_media_overlays', ['media_pk' => '111', 'board_position' => 0]);
        $this->assertDatabaseHas('showcase_media_overlays', ['media_pk' => '222', 'board_position' => 1]);
    }

    public function test_reorder_board_validates_payload(): void {
        $this->actingAs($this->user)
            ->putJson("/api/showcase/{$this->account->id}/board/order", [
                'order' => [
                    ['media_pk' => '111']
                ]
            ])
            ->assertStatus(422);
    }

    public function test_reorder_board_returns_404_for_other_users_account(): void {
        $other   = User::factory()->create();
        $account = InstagramAccount::factory()->create(['user_id' => $other->id]);

        $this->actingAs($this->user)
            ->putJson("/api/showcase/{$account->id}/board/order", [
                'order' => [['media_pk' => '111', 'position' => 0]]
            ])
            ->assertStatus(404);
    }

    public function test_reorder_board_requires_auth(): void {
        $this->putJson("/api/showcase/{$this->account->id}/board/order", [
            'order' => [['media_pk' => '111', 'position' => 0]]
        ])->assertStatus(401);
    }

    public function test_medias_merges_persisted_overlay_into_matching_post(): void {
        // документирует контракт чтения: overlay из БD примешивается к посту по pk.
        ShowcaseMediaOverlay::create([
            'instagram_account_id' => $this->account->id,
            'user_id'              => $this->user->id,
            'media_pk'             => '111',
            'is_ad'                => true,
            'note'                 => 'sponsored'
        ]);

        $this->markTestSkipped('Требует роутов /api/showcase/* и мока InstagramClientServiceInterface — добавит оркестратор.');
    }
}
