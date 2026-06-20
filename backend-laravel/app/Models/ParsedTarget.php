<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ParsedTarget extends Model {
    use HasFactory;

    protected $fillable = [
        'parse_run_id',
        'user_id',
        'target_user_pk',
        'target_username',
        'target_full_name',
        'target_profile_pic_url',
        'follower_count',
        'following_count',
        'media_count',
        'is_private',
        'is_verified',
        'media_pk',
        'media_id',
        'media_caption',
        'media_like_count',
        'media_comment_count',
        'media_taken_at',
        'metrics_snapshot',
        'status'
    ];

    protected $casts = [
        'is_private'       => 'boolean',
        'is_verified'      => 'boolean',
        'media_taken_at'   => 'datetime',
        'metrics_snapshot' => 'array'
    ];

    public function parseRun(): BelongsTo {
        return $this->belongsTo(ParseRun::class);
    }

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }

    public function actionItems(): HasMany {
        return $this->hasMany(AutomationActionItem::class);
    }
}
