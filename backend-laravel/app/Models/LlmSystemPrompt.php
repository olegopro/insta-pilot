<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LlmSystemPrompt extends Model {
    protected $fillable = [
        'key',
        'title',
        'content',
        'default_content'
    ];
}
