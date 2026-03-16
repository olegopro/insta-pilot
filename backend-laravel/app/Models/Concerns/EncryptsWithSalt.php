<?php

declare(strict_types=1);

namespace App\Models\Concerns;

use Illuminate\Encryption\Encrypter;

trait EncryptsWithSalt {
    private static ?Encrypter $saltEncrypter = null;

    private function getSaltEncrypter(): Encrypter {
        if (self::$saltEncrypter === null) {
            $salt = config('app.instagram_salt');
            $derivedKey = substr(hash('sha256', config('app.key') . $salt, true), 0, 32);
            self::$saltEncrypter = new Encrypter($derivedKey, 'AES-256-CBC');
        }

        return self::$saltEncrypter;
    }

    private function encryptData(string $data): string {
        return $this->getSaltEncrypter()->encrypt($data);
    }

    private function decryptData(string $data): string {
        return $this->getSaltEncrypter()->decrypt($data);
    }
}
