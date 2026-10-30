<?php

use App\Models\FireReport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;

uses(RefreshDatabase::class);

test('versioned report list requires authentication', function () {
    $this->getJson('/api/v1/reports')
        ->assertUnauthorized();
});

test('versioned report list returns only the authenticated resident reports', function () {
    $resident = User::factory()->create();
    $otherResident = User::factory()->create();
    $ownReport = FireReport::factory()->create(['resident_id' => $resident->id]);
    FireReport::factory()->create(['resident_id' => $otherResident->id]);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->getJson('/api/v1/reports')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.id', $ownReport->id);
});
