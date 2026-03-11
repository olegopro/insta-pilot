<?php

declare(strict_types=1);

use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\InstagramAccountController;
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

// --- Protected routes ---
Route::middleware(['auth:sanctum', EnsureUserIsActive::class])->group(function () {

    // Instagram accounts
    Route::prefix('accounts')->group(function () {
        Route::get('/', [InstagramAccountController::class, 'index']);
        Route::post('/login', [InstagramAccountController::class, 'login']);
        Route::get('/{id}', [InstagramAccountController::class, 'show']);
        Route::delete('/{id}', [InstagramAccountController::class, 'destroy']);
    });

    // Admin
    Route::prefix('admin')->middleware('role:admin')->group(function () {
        Route::get('/users', [AdminUserController::class, 'index']);
        Route::patch('/users/{id}/toggle-active', [AdminUserController::class, 'toggleActive']);
        Route::patch('/users/{id}/role', [AdminUserController::class, 'updateRole']);
    });
});
