<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\FireReportController;
use App\Http\Controllers\Api\V1\UserReportsController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->controller(AuthController::class)->group(function () {
    Route::post('/register', 'register');
    Route::post('/login', 'login');
});

Route::middleware('auth:api')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/refresh', [AuthController::class, 'refresh']);

    Route::apiResource('reports', FireReportController::class)
        ->only(['index', 'show', 'store', 'destroy']);

    Route::apiResource('users.reports', UserReportsController::class)
        ->only(['index']);
});
