<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountTargetInteraction extends Model {
    use HasFactory;

    protected $fillable = [
        'instagram_account_id',
        'target_user_pk',
        'action',
        'last_touched_at'
    ];

    protected $casts = [
        'last_touched_at' => 'datetime'
    ];

    public function instagramAccount(): BelongsTo {
        return $this->belongsTo(InstagramAccount::class);
    }
}
