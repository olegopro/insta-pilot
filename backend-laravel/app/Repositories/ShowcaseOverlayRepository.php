<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\ShowcaseMediaOverlay;
use Illuminate\Support\Collection;

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

    public function findForMedias(int $accountId, array $mediaPks): Collection {
        if ($mediaPks === []) {
            return new Collection();
        }

        return ShowcaseMediaOverlay::where('instagram_account_id', $accountId)
            ->whereIn('media_pk', $mediaPks)
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
        if ($order === []) {
            return;
        }

        // Один upsert вместо N×(firstOrNew+save): атомарно, без N+1.
        // Конфликт по unique-ключу ['instagram_account_id','media_pk'] →
        // обновляются только user_id и board_position, прочие флаги нетронуты.
        $rows = array_map(
            static fn (array $item): array => [
                'instagram_account_id' => $accountId,
                'media_pk'             => $item['media_pk'],
                'user_id'              => $userId,
                'board_position'       => $item['position']
            ],
            $order
        );

        ShowcaseMediaOverlay::upsert(
            $rows,
            ['instagram_account_id', 'media_pk'],
            ['user_id', 'board_position']
        );
    }
}
