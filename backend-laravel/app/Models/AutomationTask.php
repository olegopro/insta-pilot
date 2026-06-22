<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
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
        'action_config'            => 'array',
        'respect_working_hours'    => 'boolean',
        'collected_targets_count'  => 'integer',
        'started_at'               => 'datetime',
        'finished_at'              => 'datetime'
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

    // Подзапрос: число спарсенных целей (parsed_targets status='kept') для parse_run этой
    // задачи — «целей готово к запуску». Без parse_run → 0. Коррелированный подзапрос, без N+1.
    public function scopeWithCollectedTargetsCount(Builder $query): void {
        $query
            ->select('automation_tasks.*')
            ->selectSub(
                ParsedTarget::query()
                    ->selectRaw('count(*)')
                    ->whereColumn('parsed_targets.parse_run_id', 'automation_tasks.parse_run_id')
                    ->where('parsed_targets.status', 'kept'),
                'collected_targets_count'
            );
    }
}
