<?php

use App\Http\Controllers\Api\V1\FireReportController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::apiResource('reports', FireReportController::class)
    ->only(['index'])
    ->middleware('auth:sanctum');

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});
