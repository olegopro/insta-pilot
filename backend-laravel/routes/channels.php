<?php

declare(strict_types=1);

use App\Models\InstagramAccount;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Cache;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('comment-generation.{jobId}', function ($user, string $jobId) {
    // Владелец job пишется в кэш контроллером синхронно до dispatch (см. CommentGenerateController)
    $ownerId = Cache::get("comment-job-owner:{$jobId}");

    return $ownerId !== null && (int) $ownerId === (int) $user->id;
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

Broadcast::channel('automation-task.{taskId}', function ($user, $taskId) {
    return \App\Models\AutomationTask::where('id', $taskId)
        ->where('user_id', $user->id)
        ->exists();
});
