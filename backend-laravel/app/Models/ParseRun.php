<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ParseRun extends Model {
    use HasFactory;

    protected $fillable = [
        'user_id',
        'instagram_account_id',
        'parse_filter_preset_id',
        'mode',
        'source_type',
        'source_value',
        'filters_snapshot',
        'target_limit',
        'status',
        'scanned_count',
        'collected_count',
        'next_cursor',
        'error_message',
        'started_at',
        'finished_at'
    ];

    protected $casts = [
        'source_value'     => 'array',
        'filters_snapshot' => 'array',
        'next_cursor'      => 'array',
        'started_at'       => 'datetime',
        'finished_at'      => 'datetime'
    ];

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }

    public function instagramAccount(): BelongsTo {
        return $this->belongsTo(InstagramAccount::class);
    }

    public function parseFilterPreset(): BelongsTo {
        return $this->belongsTo(ParseFilterPreset::class);
    }

    public function parsedTargets(): HasMany {
        return $this->hasMany(ParsedTarget::class);
    }
}
