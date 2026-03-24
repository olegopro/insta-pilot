<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountActivityLog extends Model {
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'instagram_account_id',
        'user_id',
        'action',
        'status',
        'http_code',
        'endpoint',
        'request_payload',
        'response_summary',
        'error_message',
        'error_code',
        'duration_ms',
        'created_at',
    ];

    protected $casts = [
        'request_payload'  => 'array',
        'response_summary' => 'array',
        'created_at'       => 'datetime',
    ];

    public function instagramAccount(): BelongsTo {
        return $this->belongsTo(InstagramAccount::class);
    }

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }
}
