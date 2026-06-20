<?php

declare(strict_types=1);

use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AutomationSettingsController;
use App\Http\Controllers\AutomationTaskController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\CommentGenerateController;
use App\Http\Controllers\FeedController;
use App\Http\Controllers\InstagramAccountController;
use App\Http\Controllers\InstagramUserController;
use App\Http\Controllers\LlmSettingsController;
use App\Http\Controllers\ProxyImageController;
use App\Http\Controllers\SearchController;
use App\Http\Middleware\EnsureUserIsActive;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Route;

// --- Broadcasting auth ---
Route::middleware(['auth:sanctum', EnsureUserIsActive::class])
    ->post(
        '/broadcasting/auth',
        fn(\Illuminate\Http\Request $request) => Broadcast::auth($request)
    );

// --- Auth ---
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware(['auth:sanctum', EnsureUserIsActive::class])->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
    });
});

// --- Image proxy (public — img src не передаёт Authorization header) ---
Route::get('/proxy/image', [ProxyImageController::class, 'show']);

// --- Protected routes ---
Route::middleware(['auth:sanctum', EnsureUserIsActive::class])->group(function () {

    // Instagram accounts
    Route::prefix('accounts')->group(function () {
        Route::get('/', [InstagramAccountController::class, 'index']);
        Route::get('/device-profiles', [InstagramAccountController::class, 'deviceProfiles']);
        Route::post('/login', [InstagramAccountController::class, 'login']);
        Route::get('/{id}', [InstagramAccountController::class, 'show']);
        Route::delete('/{id}', [InstagramAccountController::class, 'destroy']);
    });

    // Feed
    Route::prefix('feed')->group(function () {
        Route::get('/{accountId}', [FeedController::class, 'index']);
        Route::post('/{accountId}/like', [FeedController::class, 'like']);
    });

    // Instagram users
    Route::get('/instagram-user/{accountId}/{userPk}', [InstagramUserController::class, 'show']);

    // Search
    Route::prefix('search')->group(function () {
        Route::get('/hashtag', [SearchController::class, 'hashtag']);
        Route::get('/locations', [SearchController::class, 'locations']);
        Route::get('/location', [SearchController::class, 'locationMedias']);
    });

    // Comments
    Route::get('/media/comments', [CommentController::class, 'index']);
    Route::get('/media/comments/replies', [CommentController::class, 'replies']);
    Route::post('/media/{mediaId}/comment', [CommentController::class, 'store']);

    // Comment generation (LLM + WebSocket)
    Route::post('/comments/generate', [CommentGenerateController::class, 'generate']);

    // Automation
    Route::prefix('automation')->group(function () {
        Route::get('/', [AutomationTaskController::class, 'index']);
        Route::post('/', [AutomationTaskController::class, 'store']);
        Route::get('/{id}', [AutomationTaskController::class, 'show']);
        Route::post('/{id}/parse-targets', [AutomationTaskController::class, 'parseTargets']);
        Route::get('/{id}/targets', [AutomationTaskController::class, 'targets']);
        Route::patch('/{id}/targets/{targetId}/exclude', [AutomationTaskController::class, 'excludeTarget']);
        Route::patch('/{id}/targets/{targetId}/restore', [AutomationTaskController::class, 'restoreTarget']);
        Route::post('/{id}/start', [AutomationTaskController::class, 'start']);
        Route::post('/{id}/pause', [AutomationTaskController::class, 'pause']);
        Route::post('/{id}/resume', [AutomationTaskController::class, 'resume']);
        Route::post('/{id}/cancel', [AutomationTaskController::class, 'cancel']);
    });

    // Automation settings (per account)
    Route::prefix('accounts/{accountId}/automation-settings')->group(function () {
        Route::get('/', [AutomationSettingsController::class, 'show']);
        Route::put('/limits', [AutomationSettingsController::class, 'updateLimits']);
        Route::put('/working-hours', [AutomationSettingsController::class, 'updateWorkingHours']);
    });

    // Activity logs
    Route::prefix('accounts/{accountId}/activity')->group(function () {
        Route::get('/', [ActivityLogController::class, 'index']);
        Route::get('/stats', [ActivityLogController::class, 'stats']);
    });
    Route::get('/activity/summary', [ActivityLogController::class, 'summary']);

    // Admin
    Route::prefix('admin')->middleware('role:admin')->group(function () {
        Route::get('/users', [AdminUserController::class, 'index']);
        Route::patch('/users/{id}/toggle-active', [AdminUserController::class, 'toggleActive']);
        Route::patch('/users/{id}/role', [AdminUserController::class, 'updateRole']);
    });

    // LLM Settings (admin only)
    Route::prefix('llm-settings')->middleware('role:admin')->group(function () {
        Route::get('/base-prompt', [LlmSettingsController::class, 'basePrompt']);
        Route::put('/base-prompt', [LlmSettingsController::class, 'updateBasePrompt']);
        Route::post('/base-prompt/reset', [LlmSettingsController::class, 'resetBasePrompt']);
        Route::get('/', [LlmSettingsController::class, 'index']);
        Route::post('/', [LlmSettingsController::class, 'store']);
        Route::post('/test', [LlmSettingsController::class, 'testConnection']);
        Route::get('/{id}', [LlmSettingsController::class, 'show']);
        Route::patch('/{id}/default', [LlmSettingsController::class, 'setDefault']);
        Route::delete('/{id}', [LlmSettingsController::class, 'destroy']);
    });
});
