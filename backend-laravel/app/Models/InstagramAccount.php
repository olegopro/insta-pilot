<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Encryption\Encrypter;

class InstagramAccount extends Model {
    protected $fillable = [
        'instagram_login',
        'instagram_password',
        'session_data',
        'proxy',
        'full_name',
        'profile_pic_url',
        'is_active',
        'last_used_at'
    ];

    protected $hidden = [
        'instagram_password',
        'session_data'
    ];

    private function encryptData(string $data): string {
        $salt       = config('app.instagram_salt');
        $derivedKey = substr(hash('sha256', config('app.key') . $salt, true), 0, 32);
        $encrypted  = new Encrypter($derivedKey, 'AES-256-CBC');

        return $encrypted->encrypt($data);
    }

    private function decryptData(string $data): string {
        $salt       = config('app.instagram_salt');
        $derivedKey = substr(hash('sha256', config('app.key') . $salt, true), 0, 32);
        $decrypted  = new Encrypter($derivedKey, 'AES-256-CBC');

        return $decrypted->decrypt($data);
    }


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
        return  $value === null ? null : $this->decryptData($value);
    }
}
