<?php

use App\Http\Controllers\InstagramAccountController;
use Illuminate\Support\Facades\Route;

Route::prefix('accounts')->group(function () {
    Route::get('/', [InstagramAccountController::class, 'index']);
    Route::post('/login', [InstagramAccountController::class, 'login']);
});
