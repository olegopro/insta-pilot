<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\InstagramAccount;
use App\Models\ShowcaseMediaOverlay;
use App\Models\User;
use App\Repositories\ShowcaseOverlayRepository;
use Tests\TestCase;

class ShowcaseOverlayRepositoryTest extends TestCase {
    private ShowcaseOverlayRepository $repository;
    private User $user;
    private InstagramAccount $account;

    protected function setUp(): void {
        parent::setUp();
        $this->repository = new ShowcaseOverlayRepository();
        $this->user      = User::factory()->create();
        $this->account   = InstagramAccount::factory()->create(['user_id' => $this->user->id]);
    }

    // ─── upsertFlags ─────────────────────────────────────────────────────────

    public function test_upsert_flags_creates_new_overlay(): void {
        $overlay = $this->repository->upsertFlags(
            $this->account->id,
            $this->user->id,
            '111',
            [
                'is_ad'      => true,
                'note'       => 'sponsored',
                'labels'     => ['promo', 'q2']
            ]
        );

        $this->assertInstanceOf(ShowcaseMediaOverlay::class, $overlay);
        $this->assertTrue($overlay->is_ad);
        $this->assertEquals('sponsored', $overlay->note);
        $this->assertEquals(['promo', 'q2'], $overlay->labels);
        $this->assertEquals($this->user->id, $overlay->user_id);
        $this->assertDatabaseHas('showcase_media_overlays', [
            'instagram_account_id' => $this->account->id,
            'media_pk'             => '111',
            'is_ad'                => true
        ]);
    }

    public function test_upsert_flags_updates_existing_overlay(): void {
        $this->repository->upsertFlags($this->account->id, $this->user->id, '111', ['is_ad' => true]);

        $overlay = $this->repository->upsertFlags(
            $this->account->id,
            $this->user->id,
            '111',
            ['is_tracked' => true]
        );

        // обновление, не создание новой строки
        $this->assertEquals(1, ShowcaseMediaOverlay::where('media_pk', '111')->count());
        // ранее установленный флаг сохранён
        $this->assertTrue($overlay->is_ad);
        $this->assertTrue($overlay->is_tracked);
    }

    public function test_upsert_flags_ignores_keys_outside_whitelist(): void {
        $overlay = $this->repository->upsertFlags(
            $this->account->id,
            $this->user->id,
            '111',
            [
                'is_ad'           => true,
                'board_position'  => 99,
                'is_pinned_cache' => true
            ]
        );

        // board_position / is_pinned_cache не входят в whitelist upsertFlags —
        // в БД остаются дефолты (null / false), затронут только is_ad.
        $this->assertTrue($overlay->is_ad);
        $this->assertDatabaseHas('showcase_media_overlays', [
            'media_pk'        => '111',
            'board_position'  => null,
            'is_pinned_cache' => false,
            'is_ad'           => true
        ]);
    }

    // ─── reorder ─────────────────────────────────────────────────────────────

    public function test_reorder_sets_board_position_for_each_post(): void {
        $this->repository->reorder(
            $this->account->id,
            $this->user->id,
            [
                ['media_pk' => '111', 'position' => 0],
                ['media_pk' => '222', 'position' => 1],
                ['media_pk' => '333', 'position' => 2]
            ]
        );

        $this->assertDatabaseHas('showcase_media_overlays', ['media_pk' => '111', 'board_position' => 0]);
        $this->assertDatabaseHas('showcase_media_overlays', ['media_pk' => '222', 'board_position' => 1]);
        $this->assertDatabaseHas('showcase_media_overlays', ['media_pk' => '333', 'board_position' => 2]);
    }

    public function test_reorder_updates_existing_overlay_without_duplicating(): void {
        $this->repository->upsertFlags($this->account->id, $this->user->id, '111', ['is_ad' => true]);

        $this->repository->reorder(
            $this->account->id,
            $this->user->id,
            [['media_pk' => '111', 'position' => 5]]
        );

        $this->assertEquals(1, ShowcaseMediaOverlay::where('media_pk', '111')->count());
        $overlay = ShowcaseMediaOverlay::where('media_pk', '111')->first();
        $this->assertEquals(5, $overlay->board_position);
        // флаг, выставленный ранее, не затёрт
        $this->assertTrue($overlay->is_ad);
    }

    // ─── findForMedias ─────────────────────────────────────────────────────────

    public function test_find_for_medias_returns_collection_keyed_by_media_pk(): void {
        $this->repository->upsertFlags($this->account->id, $this->user->id, '111', ['is_ad' => true]);
        $this->repository->upsertFlags($this->account->id, $this->user->id, '222', ['is_tracked' => true]);

        $result = $this->repository->findForMedias($this->account->id, ['111', '222']);

        $this->assertCount(2, $result);
        $this->assertTrue($result->has('111'));
        $this->assertTrue($result->has('222'));
        $this->assertTrue($result->get('111')->is_ad);
        $this->assertTrue($result->get('222')->is_tracked);
    }

    public function test_find_for_medias_returns_only_that_accounts_overlays(): void {
        $otherAccount = InstagramAccount::factory()->create(['user_id' => $this->user->id]);
        $this->repository->upsertFlags($this->account->id, $this->user->id, '111', ['is_ad' => true]);
        $this->repository->upsertFlags($otherAccount->id, $this->user->id, '999', ['is_ad' => true]);

        $result = $this->repository->findForMedias($this->account->id, ['111', '999']);

        $this->assertCount(1, $result);
        $this->assertTrue($result->has('111'));
        $this->assertFalse($result->has('999'));
    }

    public function test_find_for_medias_returns_only_requested_media_pks(): void {
        $this->repository->upsertFlags($this->account->id, $this->user->id, '111', ['is_ad' => true]);
        $this->repository->upsertFlags($this->account->id, $this->user->id, '222', ['is_tracked' => true]);

        $result = $this->repository->findForMedias($this->account->id, ['111']);

        $this->assertCount(1, $result);
        $this->assertTrue($result->has('111'));
        $this->assertFalse($result->has('222'));
    }

    public function test_find_for_medias_returns_empty_when_no_overlays(): void {
        $result = $this->repository->findForMedias($this->account->id, ['111']);

        $this->assertTrue($result->isEmpty());
    }

    public function test_find_for_medias_returns_empty_for_empty_media_pks(): void {
        $this->repository->upsertFlags($this->account->id, $this->user->id, '111', ['is_ad' => true]);

        $result = $this->repository->findForMedias($this->account->id, []);

        $this->assertTrue($result->isEmpty());
    }
}
