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
        ->assertJsonMissingPath('data.0.attributes.incidentDescription')
        ->assertJsonMissingPath('data.0.includes')
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
        ->assertJsonMissingPath('data.includes')
        ->assertJsonPath('data.links.self', route('reports.show', ['report' => $ownReport->id]));

    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)
        ->getJson("/api/v1/reports/{$otherReport->id}")
        ->assertNotFound();
});

test('report endpoints include only the resident name when requested', function () {
    $resident = User::factory()->create([
        'name' => 'Private Resident',
        'email' => 'private@example.com',
    ]);
    $report = FireReport::factory()->create(['resident_id' => $resident->id]);
    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->getJson('/api/v1/reports?include=Resident')
        ->assertOk()
        ->assertJsonPath('data.0.includes.resident.type', 'user')
        ->assertJsonPath('data.0.includes.resident.id', $resident->id)
        ->assertJsonPath('data.0.includes.resident.attributes.name', 'Private Resident')
        ->assertJsonMissingPath('data.0.includes.resident.attributes.email')
        ->assertJsonMissingPath('data.0.includes.resident.attributes.role');

    $this->getJson("/api/v1/reports/{$report->id}?include=resident")
        ->assertOk()
        ->assertJsonPath('data.includes.resident.attributes.name', 'Private Resident')
        ->assertJsonMissingPath('data.includes.resident.attributes.email');
});

test('report list filters by one or several statuses within the resident scope', function () {
    $resident = User::factory()->create();
    $pending = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'status' => 'pending',
    ]);
    $reviewed = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'status' => 'reviewed',
    ]);
    FireReport::factory()->create([
        'resident_id' => $resident->id,
        'status' => 'resolved',
    ]);
    FireReport::factory()->create(['status' => 'pending']);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->getJson('/api/v1/reports?status=pending,reviewed')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonFragment(['id' => $pending->id])
        ->assertJsonFragment(['id' => $reviewed->id])
        ->assertJsonPath('meta.total', 2);
});

test('report list supports wildcard address and reported-date range filters', function () {
    $resident = User::factory()->create();
    $matchingReport = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'incident_address' => 'Mansalay Central Market',
        'reported_at' => '2026-10-15 12:00:00',
    ]);
    FireReport::factory()->create([
        'resident_id' => $resident->id,
        'incident_address' => 'Mansalay Central Market',
        'reported_at' => '2026-11-02 12:00:00',
    ]);
    FireReport::factory()->create([
        'resident_id' => $resident->id,
        'incident_address' => 'Other location',
        'reported_at' => '2026-10-15 12:00:00',
    ]);
    FireReport::factory()->create([
        'incident_address' => 'Mansalay Central Market',
        'reported_at' => '2026-10-15 12:00:00',
    ]);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)
        ->getJson('/api/v1/reports?incidentAddress=*Mansalay*&reportedAt=2026-10-01,2026-10-31')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $matchingReport->id)
        ->assertJsonPath('meta.total', 1);
});

test('report list ignores unknown filters and rejects invalid date ranges', function () {
    $resident = User::factory()->create();
    FireReport::factory()->count(2)->create(['resident_id' => $resident->id]);
    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->getJson('/api/v1/reports?unknownFilter=anything&isValidDate=2026-10-01')
        ->assertOk()
        ->assertJsonPath('meta.total', 2);

    $this->getJson('/api/v1/reports?reportedAt=2026-10-31,2026-10-01')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['reportedAt']);

    $this->getJson('/api/v1/reports?reportedAt=not-a-date')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['reportedAt']);
});

test('nested report route returns the authenticated user reports and applies filters', function () {
    $resident = User::factory()->create();
    $otherResident = User::factory()->create();
    $matchingReport = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'status' => 'pending',
        'incident_address' => 'Mansalay Central',
    ]);
    FireReport::factory()->create([
        'resident_id' => $resident->id,
        'status' => 'resolved',
        'incident_address' => 'Other location',
    ]);
    FireReport::factory()->create([
        'resident_id' => $otherResident->id,
        'status' => 'pending',
        'incident_address' => 'Mansalay Central',
    ]);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)
        ->getJson("/api/v1/users/{$resident->id}/reports?status=pending&incidentAddress=*Mansalay*")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $matchingReport->id)
        ->assertJsonPath('meta.total', 1);
});

test('nested report route does not allow access to another resident reports', function () {
    $resident = User::factory()->create();
    $otherResident = User::factory()->create();

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)
        ->getJson("/api/v1/users/{$otherResident->id}/reports")
        ->assertNotFound();

    $this->withToken($token)
        ->getJson('/api/v1/users/999999/reports')
        ->assertNotFound();
});
