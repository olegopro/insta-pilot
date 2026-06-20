<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ParseFilterPreset extends Model {
    use HasFactory;

    protected $fillable = [
        'user_id',
        'title',
        'source_type',
        'source_value',
        'followers_min',
        'followers_max',
        'following_min',
        'following_max',
        'last_post_max_days',
        'likes_sum_min',
        'likes_avg_min',
        'likes_avg_max',
        'whitelist_words',
        'blacklist_words',
        'is_active'
    ];

    protected $casts = [
        'source_value'    => 'array',
        'whitelist_words' => 'array',
        'blacklist_words' => 'array',
        'is_active'      => 'boolean'
    ];

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }
}
