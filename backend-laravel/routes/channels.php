<?php

declare(strict_types=1);

use App\Models\InstagramAccount;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('comment-generation.{jobId}', function () {
    return true;
});

Broadcast::channel('account-activity.{accountId}', function ($user, $accountId) {
    if ($user->hasRole('admin')) {
        return true;
    }

    return InstagramAccount::where('id', $accountId)
        ->where('user_id', $user->id)
        ->exists();
});

Broadcast::channel('activity-global.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});
