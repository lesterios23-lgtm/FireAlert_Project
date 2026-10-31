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
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.type', 'fire_report')
        ->assertJsonPath('data.0.id', $ownReport->id)
        ->assertJsonPath('data.0.attributes.status', 'pending')
        ->assertJsonPath('data.0.relationships.resident.data.id', $resident->id)
        ->assertJsonPath('data.0.links.self', route('reports.show', ['report' => $ownReport->id]))
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('meta.per_page', 15);
});

test('versioned report list paginates only the authenticated resident reports', function () {
    $resident = User::factory()->create();
    $otherResident = User::factory()->create();
    FireReport::factory()->count(16)->create(['resident_id' => $resident->id]);
    FireReport::factory()->create(['resident_id' => $otherResident->id]);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->getJson('/api/v1/reports?page=2')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('meta.current_page', 2)
        ->assertJsonPath('meta.total', 16)
        ->assertJsonPath('meta.per_page', 15);
});

test('versioned report detail uses the resource and hides reports belonging to other residents', function () {
    $resident = User::factory()->create();
    $otherResident = User::factory()->create();
    $ownReport = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'incident_description' => 'Smoke visible near the market.',
    ]);
    $otherReport = FireReport::factory()->create(['resident_id' => $otherResident->id]);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->getJson("/api/v1/reports/{$ownReport->id}")
        ->assertOk()
        ->assertJsonPath('data.type', 'fire_report')
        ->assertJsonPath('data.id', $ownReport->id)
        ->assertJsonPath('data.attributes.incidentDescription', 'Smoke visible near the market.')
        ->assertJsonPath('data.relationships.resident.data.id', $resident->id)
        ->assertJsonPath('data.links.self', route('reports.show', ['report' => $ownReport->id]));

    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)
        ->getJson("/api/v1/reports/{$otherReport->id}")
        ->assertNotFound();
});
