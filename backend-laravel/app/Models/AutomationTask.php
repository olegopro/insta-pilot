<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AutomationTask extends Model {
    use HasFactory;

    protected $fillable = [
        'user_id',
        'instagram_account_id',
        'parse_run_id',
        'mode',
        'action_type',
        'action_config',
        'target_count',
        'spread_seconds',
        'jitter_seconds',
        'respect_working_hours',
        'status',
        'items_total',
        'items_done',
        'items_failed',
        'items_skipped',
        'started_at',
        'finished_at'
    ];

    protected $casts = [
        'action_config'         => 'array',
        'respect_working_hours' => 'boolean',
        'started_at'            => 'datetime',
        'finished_at'           => 'datetime'
    ];

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }

    public function instagramAccount(): BelongsTo {
        return $this->belongsTo(InstagramAccount::class);
    }

    public function parseRun(): BelongsTo {
        return $this->belongsTo(ParseRun::class);
    }

    public function actionItems(): HasMany {
        return $this->hasMany(AutomationActionItem::class);
    }
}
