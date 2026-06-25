<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\ShowcaseMediaOverlay;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ShowcaseOverlayRepository implements ShowcaseOverlayRepositoryInterface {
    /**
     * Ключи overlay-флагов, разрешённые к обновлению через upsertFlags.
     */
    private const FLAG_KEYS = [
        'is_ad',
        'is_tracked',
        'is_hidden_local',
        'note',
        'labels'
    ];

    public function findForAccount(int $accountId): Collection {
        return ShowcaseMediaOverlay::where('instagram_account_id', $accountId)
            ->get()
            ->keyBy('media_pk');
    }

    public function upsertFlags(int $accountId, int $userId, string $mediaPk, array $attrs): ShowcaseMediaOverlay {
        $overlay = ShowcaseMediaOverlay::firstOrNew([
            'instagram_account_id' => $accountId,
            'media_pk'             => $mediaPk
        ]);

        $overlay->user_id = $userId;

        foreach (self::FLAG_KEYS as $key) {
            if (array_key_exists($key, $attrs)) {
                $overlay->{$key} = $attrs[$key];
            }
        }

        $overlay->save();

        return $overlay;
    }

    public function reorder(int $accountId, int $userId, array $order): void {
        DB::transaction(function () use ($accountId, $userId, $order): void {
            foreach ($order as $item) {
                $overlay = ShowcaseMediaOverlay::firstOrNew([
                    'instagram_account_id' => $accountId,
                    'media_pk'             => $item['media_pk']
                ]);

                $overlay->user_id        = $userId;
                $overlay->board_position = $item['position'];
                $overlay->save();
            }
        });
    }
}
