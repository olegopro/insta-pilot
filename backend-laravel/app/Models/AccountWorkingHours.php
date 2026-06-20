<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountWorkingHours extends Model {
    use HasFactory;

    protected $fillable = [
        'instagram_account_id',
        'user_id',
        'schedule',
        'timezone',
        'is_enabled'
    ];

    protected $casts = [
        'schedule'   => 'array',
        'is_enabled' => 'boolean'
    ];

    public function instagramAccount(): BelongsTo {
        return $this->belongsTo(InstagramAccount::class);
    }

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }
}
