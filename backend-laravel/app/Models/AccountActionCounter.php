<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountActionCounter extends Model {
    use HasFactory;

    protected $fillable = [
        'instagram_account_id',
        'action',
        'local_date',
        'used'
    ];

    protected $casts = [
        'local_date' => 'date'
    ];

    public function instagramAccount(): BelongsTo {
        return $this->belongsTo(InstagramAccount::class);
    }
}
