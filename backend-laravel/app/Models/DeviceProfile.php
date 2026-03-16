<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DeviceProfile extends Model {
    use HasFactory;

    protected $fillable = [
        'code',
        'title',
        'device_settings',
        'user_agent',
        'is_active'
    ];

    protected $casts = [
        'device_settings' => 'array',
        'is_active'       => 'boolean'
    ];

    public function instagramAccounts(): HasMany {
        return $this->hasMany(InstagramAccount::class);
    }
}
