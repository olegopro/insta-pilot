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
}
