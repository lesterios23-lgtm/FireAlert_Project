<?php

use App\Models\FireReport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

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

    Sanctum::actingAs($resident);

    $this->getJson('/api/v1/reports')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.id', $ownReport->id);
});

test('versioned user endpoint is registered and the existing api endpoint remains available', function () {
    $resident = User::factory()->create();

    Sanctum::actingAs($resident);

    $this->getJson('/api/v1/user')
        ->assertOk()
        ->assertJsonPath('id', $resident->id);

    $this->getJson('/api/user')
        ->assertOk()
        ->assertJsonPath('id', $resident->id);
});
