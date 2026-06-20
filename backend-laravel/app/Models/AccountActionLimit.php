<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountActionLimit extends Model {
    use HasFactory;

    protected $fillable = [
        'instagram_account_id',
        'user_id',
        'action',
        'daily_limit',
        'min_action_spacing_sec',
        'is_active'
    ];

    protected $casts = [
        'is_active' => 'boolean'
    ];

    public function instagramAccount(): BelongsTo {
        return $this->belongsTo(InstagramAccount::class);
    }

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }
}
