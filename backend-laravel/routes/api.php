<?php

declare(strict_types=1);

use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\FeedController;
use App\Http\Controllers\InstagramAccountController;
use App\Http\Controllers\InstagramUserController;
use App\Http\Controllers\ProxyImageController;
use App\Http\Controllers\SearchController;
use App\Http\Middleware\EnsureUserIsActive;
use Illuminate\Support\Facades\Route;

// --- Auth ---
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware(['auth:sanctum', EnsureUserIsActive::class])->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
    });
});

// --- Public proxy ---
Route::get('/proxy/image', [ProxyImageController::class, 'show']);

// --- Protected routes ---
Route::middleware(['auth:sanctum', EnsureUserIsActive::class])->group(function () {

    // Instagram accounts
    Route::prefix('accounts')->group(function () {
        Route::get('/', [InstagramAccountController::class, 'index']);
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
    Route::post('/media/{mediaPk}/comment', [CommentController::class, 'store']);

    // Admin
    Route::prefix('admin')->middleware('role:admin')->group(function () {
        Route::get('/users', [AdminUserController::class, 'index']);
        Route::patch('/users/{id}/toggle-active', [AdminUserController::class, 'toggleActive']);
        Route::patch('/users/{id}/role', [AdminUserController::class, 'updateRole']);
    });
});
