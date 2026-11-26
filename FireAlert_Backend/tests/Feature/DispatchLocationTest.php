<?php

use App\Models\FireIncident;
use App\Models\FireReport;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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

test('responder GPS stationary within 75m automatically updates report and incident to arrived', function () {
    $resident = User::factory()->create();
    $bfp = User::factory()->manager()->create();
    $incident = FireIncident::create([
        'code' => 'INC-ARR1',
        'incident_address' => 'Mansalay Public Market',
        'status' => 'responding',
        'first_reported_at' => now(),
        'last_reported_at' => now(),
    ]);
    $anchor = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'fire_incident_id' => $incident->id,
        'latitude' => 12.5189,
        'longitude' => 121.4381,
        'status' => 'responding',
    ]);
    $member = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'fire_incident_id' => $incident->id,
        'latitude' => 12.5189,
        'longitude' => 121.4381,
        'status' => 'responding',
    ]);
    $dispatchId = dispatchFor($anchor, [
        'current_latitude' => 12.51892,
        'current_longitude' => 121.43812,
        'location_updated_at' => now()->subSeconds(15),
    ]);

    // A fix far (>75m) away must not auto-arrive
    $farIncident = FireIncident::create([
        'code' => 'INC-FAR1',
        'incident_address' => 'Far Barangay',
        'status' => 'responding',
        'first_reported_at' => now(),
        'last_reported_at' => now(),
    ]);
    $farReport = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'fire_incident_id' => $farIncident->id,
        'latitude' => 12.55,
        'longitude' => 121.45,
        'status' => 'responding',
    ]);
    dispatchFor($farReport);

    $this->withToken(loginToken($bfp))
        ->postJson('/api/v1/reports/'.$farReport->getKey().'/dispatch-location', [
            'latitude' => 12.5189,
            'longitude' => 121.4381,
            'arrived' => true,
        ])
        ->assertOk()
        ->assertJsonPath('data.auto_arrived', false);
    expect($farReport->fresh()->status)->toBe('responding');

    // Stationary within 75m after >=10s automatically marks Arrived
    $this->withToken(loginToken($bfp))
        ->postJson('/api/v1/reports/'.$anchor->getKey().'/dispatch-location', [
            'latitude' => 12.51891,
            'longitude' => 121.43811,
            'accuracy_meters' => 8,
        ])
        ->assertOk()
        ->assertJsonPath('data.auto_arrived', true)
        ->assertJsonPath('data.status', 'arrived');

    expect($anchor->fresh()->status)->toBe('arrived');
    expect($member->fresh()->status)->toBe('arrived');
    expect($incident->fresh()->status)->toBe('arrived');
    expect(DB::table('response_dispatches')->where('dispatch_id', $dispatchId)->value('arrived_at'))->not->toBeNull();
});

test('explicit arrived flag within 75m transitions responding report to arrived', function () {
    $resident = User::factory()->create();
    $bfp = User::factory()->manager()->create();
    $report = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'latitude' => 12.5189,
        'longitude' => 121.4381,
        'status' => 'responding',
    ]);
    $dispatchId = dispatchFor($report);

    $this->withToken(loginToken($bfp))
        ->postJson('/api/v1/reports/'.$report->getKey().'/dispatch-location', [
            'latitude' => 12.5189,
            'longitude' => 121.4381,
            'arrived' => true,
        ])
        ->assertOk()
        ->assertJsonPath('data.auto_arrived', true)
        ->assertJsonPath('data.status', 'arrived');

    expect($report->fresh()->status)->toBe('arrived');
    expect(DB::table('response_dispatches')->where('dispatch_id', $dispatchId)->value('arrived_at'))->not->toBeNull();
});

test('admin without personal bfp_personnel row can save incident record using dispatched personnel_id', function () {
    if (! Schema::hasTable('bfp_personnel')) {
        Schema::create('bfp_personnel', function (Blueprint $table): void {
            $table->increments('personnel_id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('badge_number')->nullable();
            $table->string('rank_position')->nullable();
        });
    }
    if (! Schema::hasTable('incident_records')) {
        Schema::create('incident_records', function (Blueprint $table): void {
            $table->increments('record_id');
            $table->unsignedBigInteger('report_id');
            $table->unsignedBigInteger('personnel_id');
            $table->text('damage_assessment')->nullable();
            $table->integer('casualties_count')->default(0);
            $table->text('resolution_summary')->nullable();
            $table->timestamp('archived_at')->nullable();
        });
    }

    $resident = User::factory()->create();
    $admin = User::factory()->create(['role' => 'admin']);
    $staff = User::factory()->manager()->create();
    $personnelId = (int) DB::table('bfp_personnel')->insertGetId([
        'user_id' => $staff->id,
        'badge_number' => 'BFP-101',
        'rank_position' => 'FO1',
    ]);
    $report = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'status' => 'arrived',
    ]);
    dispatchFor($report, ['personnel_id' => $personnelId]);

    $this->withToken(loginToken($admin))
        ->putJson('/api/v1/reports/'.$report->getKey().'/incident-record', [
            'damage_assessment' => 'Minor roof damage',
            'casualties_count' => 0,
            'resolution_summary' => 'Fire suppressed and declared fire out.',
        ])
        ->assertOk();

    $this->assertDatabaseHas('incident_records', [
        'report_id' => $report->getKey(),
        'personnel_id' => $personnelId,
        'damage_assessment' => 'Minor roof damage',
        'casualties_count' => 0,
        'resolution_summary' => 'Fire suppressed and declared fire out.',
    ]);
});
