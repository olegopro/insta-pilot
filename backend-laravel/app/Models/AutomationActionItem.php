<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AutomationActionItem extends Model {
    use HasFactory;

    protected $fillable = [
        'automation_task_id',
        'instagram_account_id',
        'user_id',
        'parsed_target_id',
        'action_type',
        'target_user_pk',
        'media_pk',
        'media_id',
        'payload',
        'result',
        'status',
        'run_at',
        'claim_token',
        'claimed_at',
        'claim_expires_at',
        'quota_reserved_at',
        'attempts',
        'error_code',
        'error_message',
        'activity_log_id',
        'executed_at'
    ];

    protected $casts = [
        'payload'           => 'array',
        'result'            => 'array',
        'run_at'            => 'datetime',
        'claimed_at'        => 'datetime',
        'claim_expires_at'  => 'datetime',
        'quota_reserved_at' => 'datetime',
        'executed_at'       => 'datetime'
    ];

    public function automationTask(): BelongsTo {
        return $this->belongsTo(AutomationTask::class);
    }

    public function instagramAccount(): BelongsTo {
        return $this->belongsTo(InstagramAccount::class);
    }

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }

    public function parsedTarget(): BelongsTo {
        return $this->belongsTo(ParsedTarget::class);
    }

    public function activityLog(): BelongsTo {
        return $this->belongsTo(AccountActivityLog::class);
    }
}
