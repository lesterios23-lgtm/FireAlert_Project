<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\AdminDashboardController;
use App\Http\Controllers\Api\V1\BfpCommandCenterController;
use App\Http\Controllers\Api\V1\FireIncidentController;
use App\Http\Controllers\Api\V1\FireReportController;
use App\Http\Controllers\Api\V1\UserController;
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
    Route::match(['patch', 'post'], '/auth/profile', [AuthController::class, 'updateProfile']);
    Route::get('admin/dashboard', [AdminDashboardController::class, 'index']);
    Route::get('admin/high-risk-areas', [AdminDashboardController::class, 'highRiskAreas']);
    Route::put('admin/login-attempt-settings', [AdminDashboardController::class, 'updateLoginAttemptSettings']);
    Route::post('admin/users', [AdminDashboardController::class, 'storeUser']);
    Route::patch('admin/users/{user}', [AdminDashboardController::class, 'updateUser']);
    Route::delete('admin/users/{user}', [AdminDashboardController::class, 'destroyUser']);
    Route::post('admin/firetrucks', [AdminDashboardController::class, 'storeFiretruck']);
    Route::patch('admin/firetrucks/{truckId}', [AdminDashboardController::class, 'updateFiretruck']);
    Route::delete('admin/firetrucks/{truckId}', [AdminDashboardController::class, 'destroyFiretruck']);
    Route::get('command-center', [BfpCommandCenterController::class, 'index']);
    Route::get('incidents', [FireIncidentController::class, 'index']);
    Route::get('incidents/{incident}', [FireIncidentController::class, 'show']);
    Route::post('incidents/{incident}/reports/{report}/attach', [FireIncidentController::class, 'attach']);
    Route::post('incidents/{incident}/merge', [FireIncidentController::class, 'merge']);
    Route::post('reports/{report}/detach', [FireIncidentController::class, 'detach']);
    Route::patch('incidents/{incident}/status', [FireIncidentController::class, 'updateStatus']);
    Route::post('reports/{report}/dispatch', [BfpCommandCenterController::class, 'dispatch']);
    Route::post('reports/{report}/dispatch-location', [BfpCommandCenterController::class, 'updateDispatchLocation']);
    Route::put('reports/{report}/incident-record', [BfpCommandCenterController::class, 'saveIncidentRecord']);

    Route::apiResource('users', UserController::class)
        ->only(['index', 'show', 'store', 'destroy']);
    Route::put('users/{user}', [UserController::class, 'replace']);
    Route::patch('users/{user}', [UserController::class, 'update']);

    Route::apiResource('reports', FireReportController::class)
        ->only(['index', 'show', 'store', 'destroy']);
    Route::get('reports/{report}/evidence', [FireReportController::class, 'evidence']);
    Route::put('reports/{report}', [FireReportController::class, 'replace']);
    Route::patch('reports/{report}', [FireReportController::class, 'update']);

    Route::apiResource('users.reports', UserReportsController::class)
        ->only(['index', 'store', 'destroy']);
    Route::put('users/{user}/reports/{report}', [UserReportsController::class, 'replace']);
    Route::patch('users/{user}/reports/{report}', [UserReportsController::class, 'update']);
});
