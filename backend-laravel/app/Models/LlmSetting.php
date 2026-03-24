<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\EncryptsWithSalt;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LlmSetting extends Model {
    use HasFactory;
    use EncryptsWithSalt;

    protected $fillable = [
        'provider',
        'api_key',
        'model_name',
        'system_prompt',
        'tone',
        'use_caption',
        'is_default'
    ];

    protected $hidden = ['api_key'];

    protected $casts = [
        'is_default'  => 'boolean',
        'use_caption' => 'boolean'
    ];

    public function setApiKeyAttribute(string $value): void {
        $this->attributes['api_key'] = $this->encryptData($value);
    }

    public function getApiKeyAttribute(string $value): string {
        return $this->decryptData($value);
    }
}
