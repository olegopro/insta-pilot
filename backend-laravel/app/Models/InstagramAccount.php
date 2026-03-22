<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\EncryptsWithSalt;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InstagramAccount extends Model {
    use HasFactory;
    use EncryptsWithSalt;

    protected $fillable = [
        'user_id',
        'instagram_login',
        'instagram_password',
        'session_data',
        'device_profile_id',
        'device_model_name',
        'full_name',
        'profile_pic_url',
        'is_active',
        'last_used_at'
    ];

    protected $hidden = [
        'instagram_password',
        'session_data'
    ];

    public function setInstagramPasswordAttribute(string $value): void {
        $this->attributes['instagram_password'] = $this->encryptData($value);
    }

    public function getInstagramPasswordAttribute(string $value): string {
        return $this->decryptData($value);
    }

    public function setSessionDataAttribute(?string $value): void {
        $this->attributes['session_data'] = $value === null ? null : $this->encryptData($value);
    }

    public function getSessionDataAttribute(?string $value): ?string {
        return $value === null ? null : $this->decryptData($value);
    }

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }

    public function deviceProfile(): BelongsTo {
        return $this->belongsTo(DeviceProfile::class);
    }
}
