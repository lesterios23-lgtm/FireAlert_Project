<?php

use App\Models\FireIncident;
use App\Models\FireReport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

function dispatchFor(FireReport $report, array $attributes = []): int
{
    return (int) DB::table('response_dispatches')->insertGetId(array_merge([
        'report_id' => $report->getKey(),
        'truck_id' => 1,
        'personnel_id' => 1,
        'dispatched_at' => now(),
        'estimated_eta_minutes' => 8,
    ], $attributes));
}

test('a BFP responder can publish a live GPS fix for the dispatched unit', function () {
    $resident = User::factory()->create();
    $bfp = User::factory()->manager()->create();
    $report = FireReport::factory()->create(['resident_id' => $resident->id]);
    $dispatchId = dispatchFor($report);

    $this->withToken(loginToken($bfp))
        ->postJson('/api/v1/reports/'.$report->getKey().'/dispatch-location', [
            'latitude' => 12.5189,
            'longitude' => 121.4381,
            'accuracy_meters' => 14.5,
        ])
        ->assertOk()
        ->assertJsonPath('data.dispatch.id', $dispatchId)
        ->assertJsonPath('data.dispatch.current_latitude', 12.5189)
        ->assertJsonPath('data.dispatch.current_longitude', 121.4381)
        ->assertJsonPath('data.dispatch.current_location.latitude', 12.5189);

    $this->assertDatabaseHas('response_dispatches', [
        'dispatch_id' => $dispatchId,
        'current_latitude' => 12.5189,
        'current_longitude' => 121.4381,
    ]);
});

test('a resident can see the live responder location on their own report', function () {
    $resident = User::factory()->create();
    $report = FireReport::factory()->create(['resident_id' => $resident->id]);
    dispatchFor($report, [
        'current_latitude' => 12.517,
        'current_longitude' => 121.437,
        'location_accuracy_meters' => 9,
        'location_updated_at' => now(),
    ]);

    $this->withToken(loginToken($resident))
        ->getJson('/api/v1/reports/'.$report->getKey())
        ->assertOk()
        ->assertJsonPath('dispatch.current_latitude', 12.517)
        ->assertJsonPath('dispatch.current_longitude', 121.437)
        ->assertJsonPath('dispatch.current_location.accuracyMeters', 9);
});

test('residents cannot publish responder locations', function () {
    $resident = User::factory()->create();
    $report = FireReport::factory()->create(['resident_id' => $resident->id]);
    dispatchFor($report);

    $this->withToken(loginToken($resident))
        ->postJson('/api/v1/reports/'.$report->getKey().'/dispatch-location', [
            'latitude' => 12.5189,
            'longitude' => 121.4381,
        ])
        ->assertForbidden();
});

test('publishing a location validates coordinates and requires an active dispatch', function () {
    $resident = User::factory()->create();
    $bfp = User::factory()->manager()->create();
    $report = FireReport::factory()->create(['resident_id' => $resident->id]);

    $this->withToken(loginToken($bfp))
        ->postJson('/api/v1/reports/'.$report->getKey().'/dispatch-location', [
            'latitude' => 91,
            'longitude' => 121.4381,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['latitude']);

    $this->withToken(loginToken($bfp))
        ->postJson('/api/v1/reports/'.$report->getKey().'/dispatch-location', [
            'latitude' => 12.5189,
            'longitude' => 121.4381,
        ])
        ->assertStatus(422);
});

test('a grouped report shares the incident dispatch and live location', function () {
    $resident = User::factory()->create();
    $bfp = User::factory()->manager()->create();
    $incident = FireIncident::create([
        'code' => 'INC-TEST1',
        'incident_address' => 'Purok 3, Brgy. Poblacion',
        'status' => 'responding',
        'first_reported_at' => now(),
        'last_reported_at' => now(),
    ]);
    $anchor = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'fire_incident_id' => $incident->id,
    ]);
    $member = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'fire_incident_id' => $incident->id,
    ]);
    $dispatchId = dispatchFor($anchor);

    $this->withToken(loginToken($bfp))
        ->postJson('/api/v1/reports/'.$member->getKey().'/dispatch-location', [
            'latitude' => 12.51,
            'longitude' => 121.43,
        ])
        ->assertOk()
        ->assertJsonPath('data.dispatch.id', $dispatchId);

    $this->withToken(loginToken($resident))
        ->getJson('/api/v1/reports/'.$member->getKey())
        ->assertOk()
        ->assertJsonPath('dispatch.id', $dispatchId)
        ->assertJsonPath('dispatch.current_location.latitude', 12.51);
});
