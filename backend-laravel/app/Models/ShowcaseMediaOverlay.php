<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShowcaseMediaOverlay extends Model {
    use HasFactory;

    protected $fillable = [
        'instagram_account_id',
        'user_id',
        'media_pk',
        'media_id',
        'board_position',
        'is_ad',
        'is_tracked',
        'is_hidden_local',
        'is_pinned_cache',
        'note',
        'labels',
        'ig_snapshot',
        'synced_at'
    ];

    protected $casts = [
        'labels'          => 'array',
        'ig_snapshot'     => 'array',
        'board_position'  => 'integer',
        'is_ad'           => 'boolean',
        'is_tracked'      => 'boolean',
        'is_hidden_local' => 'boolean',
        'is_pinned_cache' => 'boolean',
        'synced_at'       => 'datetime'
    ];

    public function instagramAccount(): BelongsTo {
        return $this->belongsTo(InstagramAccount::class);
    }

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }

    /**
     * Overlay-блок поста в замороженном snake_case-формате контракта —
     * единый источник сериализации для чтения (ShowcaseController) и
     * записи (ShowcaseOverlayController).
     *
     * При $overlay === null отдаются дефолты (как у поста без локальной
     * обёртки): board_position/note/labels — null, флаги — false.
     *
     * @return array<string, mixed>
     */
    public static function toContractArray(?self $overlay): array {
        return [
            'board_position'  => $overlay?->board_position,
            'is_ad'           => $overlay?->is_ad ?? false,
            'is_tracked'      => $overlay?->is_tracked ?? false,
            'is_hidden_local' => $overlay?->is_hidden_local ?? false,
            'note'            => $overlay?->note,
            'labels'          => $overlay?->labels
        ];
    }
}
