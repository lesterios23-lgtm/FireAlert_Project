<?php

use App\Models\FireReport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;

uses(RefreshDatabase::class);

test('creating a report requires authentication', function () {
    $this->postJson('/api/v1/reports', [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Smoke reported near the market.',
                'incidentAddress' => 'Mansalay Central Market',
            ],
        ],
    ])->assertUnauthorized();
});

test('authenticated resident can create a report with an address', function () {
    $resident = User::factory()->create();
    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->postJson('/api/v1/reports', [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Smoke reported near the market.',
                'incidentAddress' => 'Mansalay Central Market',
            ],
        ],
    ])
        ->assertCreated()
        ->assertJsonPath('data.type', 'fire_report')
        ->assertJsonPath('data.attributes.incidentDescription', 'Smoke reported near the market.')
        ->assertJsonPath('data.attributes.incidentAddress', 'Mansalay Central Market')
        ->assertJsonPath('data.attributes.status', 'pending')
        ->assertJsonPath('data.relationships.resident.data.id', $resident->id);

    $this->assertDatabaseHas('fire_reports', [
        'resident_id' => $resident->id,
        'incident_description' => 'Smoke reported near the market.',
        'incident_address' => 'Mansalay Central Market',
        'status' => 'pending',
    ]);
});

test('authenticated resident can create a report with a coordinate pair', function () {
    $resident = User::factory()->create();
    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->postJson('/api/v1/reports', [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Fire reported at the selected location.',
                'latitude' => 12.5204,
                'longitude' => 121.4392,
                'locationSource' => 'manual',
            ],
        ],
    ])
        ->assertCreated()
        ->assertJsonPath('data.attributes.latitude', '12.5204000')
        ->assertJsonPath('data.attributes.longitude', '121.4392000')
        ->assertJsonPath('data.attributes.locationSource', 'manual');
});

test('report creation validates required incident details and location', function () {
    $resident = User::factory()->create();
    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->postJson('/api/v1/reports', [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => '',
            ],
        ],
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'data.attributes.incidentDescription',
            'data.attributes.incidentAddress',
        ]);
});

test('report creation rejects incomplete or out of range coordinates', function () {
    $resident = User::factory()->create();
    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->postJson('/api/v1/reports', [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Fire reported at the selected location.',
                'latitude' => 100,
                'locationSource' => 'device',
            ],
        ],
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'data.attributes.latitude',
            'data.attributes.longitude',
        ]);
});

test('resident cannot assign report ownership or workflow fields', function () {
    $resident = User::factory()->create();
    $otherResident = User::factory()->create();
    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->postJson('/api/v1/reports', [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Smoke reported near the market.',
                'incidentAddress' => 'Mansalay Central Market',
                'residentId' => $otherResident->id,
                'status' => 'resolved',
            ],
        ],
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('data.attributes');

    $this->assertDatabaseCount('fire_reports', 0);
});

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

test('report list sorts by allowed columns in ascending and descending order', function () {
    $resident = User::factory()->create();
    $pending = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'status' => 'pending',
        'reported_at' => '2026-10-10 12:00:00',
    ]);
    $reviewed = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'status' => 'reviewed',
        'reported_at' => '2026-10-20 12:00:00',
    ]);
    $resolved = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'status' => 'resolved',
        'reported_at' => '2026-10-15 12:00:00',
    ]);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->getJson('/api/v1/reports?sort=status')
        ->assertOk()
        ->assertJsonPath('data.0.id', $pending->id)
        ->assertJsonPath('data.1.id', $resolved->id)
        ->assertJsonPath('data.2.id', $reviewed->id);

    $this->getJson('/api/v1/reports?sort=-reportedAt')
        ->assertOk()
        ->assertJsonPath('data.0.id', $reviewed->id)
        ->assertJsonPath('data.1.id', $resolved->id)
        ->assertJsonPath('data.2.id', $pending->id);
});

test('report sorting supports multiple columns and ignores unsupported columns', function () {
    $resident = User::factory()->create();
    $pendingOlder = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'status' => 'pending',
        'reported_at' => '2026-10-10 12:00:00',
    ]);
    $pendingNewer = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'status' => 'pending',
        'reported_at' => '2026-10-20 12:00:00',
    ]);
    $reviewed = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'status' => 'reviewed',
        'reported_at' => '2026-10-25 12:00:00',
    ]);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->getJson('/api/v1/reports?sort=status,-reportedAt')
        ->assertOk()
        ->assertJsonPath('data.0.id', $pendingNewer->id)
        ->assertJsonPath('data.1.id', $pendingOlder->id)
        ->assertJsonPath('data.2.id', $reviewed->id);

    $this->getJson('/api/v1/reports?sort=privateColumn')
        ->assertOk()
        ->assertJsonCount(3, 'data')
        ->assertJsonPath('meta.total', 3);
});

test('nested report list supports the same allow-listed sorting', function () {
    $resident = User::factory()->create();
    $pending = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'status' => 'pending',
    ]);
    $reviewed = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'status' => 'reviewed',
    ]);
    FireReport::factory()->create(['status' => 'pending']);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)
        ->getJson("/api/v1/users/{$resident->id}/reports?sort=-status")
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.id', $reviewed->id)
        ->assertJsonPath('data.1.id', $pending->id);
});

test('deleting a report requires authentication', function () {
    $this->deleteJson('/api/v1/reports/1')->assertUnauthorized();
});

test('authenticated resident can delete their report', function () {
    $resident = User::factory()->create();
    $report = FireReport::factory()->create([
        'resident_id' => $resident->id,
    ]);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->deleteJson("/api/v1/reports/{$report->id}")
        ->assertOk()
        ->assertJsonPath('data', null)
        ->assertJsonPath('message', 'Report successfully deleted')
        ->assertJsonPath('status', 200);

    $this->assertDatabaseMissing('fire_reports', [
        'id' => $report->id,
    ]);
});

test('deleting a non-existent report returns 404', function () {
    $resident = User::factory()->create();
    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->deleteJson('/api/v1/reports/99999')
        ->assertNotFound();
});

test('deleting an already deleted report is idempotent and returns 404', function () {
    $resident = User::factory()->create();
    $report = FireReport::factory()->create([
        'resident_id' => $resident->id,
    ]);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->deleteJson("/api/v1/reports/{$report->id}")
        ->assertOk();

    $this->withToken($token)->deleteJson("/api/v1/reports/{$report->id}")
        ->assertNotFound();
});

test('resident cannot delete another resident report', function () {
    $resident = User::factory()->create();
    $otherResident = User::factory()->create();
    $otherReport = FireReport::factory()->create([
        'resident_id' => $otherResident->id,
    ]);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->deleteJson("/api/v1/reports/{$otherReport->id}")
        ->assertNotFound();

    $this->assertDatabaseHas('fire_reports', [
        'id' => $otherReport->id,
    ]);
});

test('replacing a report requires authentication', function () {
    $this->putJson('/api/v1/reports/1', [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Replacement test',
                'incidentAddress' => 'New Address',
            ],
        ],
    ])->assertUnauthorized();
});

test('authenticated resident can replace their report with PUT', function () {
    $resident = User::factory()->create();
    $report = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'incident_description' => 'Original description',
        'incident_address' => 'Original address',
        'latitude' => null,
        'longitude' => null,
        'location_source' => null,
    ]);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->putJson("/api/v1/reports/{$report->id}", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Fully replaced fire description.',
                'latitude' => 12.5204,
                'longitude' => 121.4392,
                'locationSource' => 'manual',
            ],
        ],
    ])
        ->assertOk()
        ->assertJsonPath('data.type', 'fire_report')
        ->assertJsonPath('data.attributes.incidentDescription', 'Fully replaced fire description.')
        ->assertJsonPath('data.attributes.incidentAddress', null)
        ->assertJsonPath('data.attributes.latitude', '12.5204000')
        ->assertJsonPath('data.attributes.longitude', '121.4392000')
        ->assertJsonPath('data.attributes.locationSource', 'manual');

    $this->assertDatabaseHas('fire_reports', [
        'id' => $report->id,
        'incident_description' => 'Fully replaced fire description.',
        'incident_address' => null,
        'location_source' => 'manual',
    ]);
});

test('replacing a report requires all mandatory fields', function () {
    $resident = User::factory()->create();
    $report = FireReport::factory()->create([
        'resident_id' => $resident->id,
    ]);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->putJson("/api/v1/reports/{$report->id}", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentAddress' => 'Only address sent',
            ],
        ],
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'data.attributes.incidentDescription',
        ]);
});

test('replacing a report rejects unknown or workflow fields', function () {
    $resident = User::factory()->create();
    $report = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'status' => 'pending',
    ]);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->putJson("/api/v1/reports/{$report->id}", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Attempting status change',
                'incidentAddress' => 'Valid address',
                'status' => 'resolved',
            ],
        ],
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('data.attributes');

    $this->assertDatabaseHas('fire_reports', [
        'id' => $report->id,
        'status' => 'pending',
    ]);
});

test('resident cannot replace another resident report', function () {
    $resident = User::factory()->create();
    $otherResident = User::factory()->create();
    $otherReport = FireReport::factory()->create([
        'resident_id' => $otherResident->id,
        'incident_description' => 'Original other description',
    ]);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->putJson("/api/v1/reports/{$otherReport->id}", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Tampering attempt',
                'incidentAddress' => 'Tampering address',
            ],
        ],
    ])
        ->assertNotFound();

    $this->assertDatabaseHas('fire_reports', [
        'id' => $otherReport->id,
        'incident_description' => 'Original other description',
    ]);
});

test('replacing a non-existent report returns 404', function () {
    $resident = User::factory()->create();
    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->putJson('/api/v1/reports/99999', [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Non existent',
                'incidentAddress' => 'Somewhere',
            ],
        ],
    ])
        ->assertNotFound();
});

test('updating a report with PATCH requires authentication', function () {
    $this->patchJson('/api/v1/reports/1', [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Patched description',
            ],
        ],
    ])->assertUnauthorized();
});

test('authenticated resident can partially update incident description with PATCH', function () {
    $resident = User::factory()->create();
    $report = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'incident_description' => 'Original description',
        'incident_address' => 'Mansalay Market',
    ]);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->patchJson("/api/v1/reports/{$report->id}", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Patched description only.',
            ],
        ],
    ])
        ->assertOk()
        ->assertJsonPath('data.attributes.incidentDescription', 'Patched description only.')
        ->assertJsonPath('data.attributes.incidentAddress', 'Mansalay Market');

    $this->assertDatabaseHas('fire_reports', [
        'id' => $report->id,
        'incident_description' => 'Patched description only.',
        'incident_address' => 'Mansalay Market',
    ]);
});

test('authenticated resident can partially update location with PATCH', function () {
    $resident = User::factory()->create();
    $report = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'incident_description' => 'Original description stays',
        'latitude' => null,
        'longitude' => null,
        'location_source' => null,
    ]);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->patchJson("/api/v1/reports/{$report->id}", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'latitude' => 12.5204,
                'longitude' => 121.4392,
                'locationSource' => 'device',
            ],
        ],
    ])
        ->assertOk()
        ->assertJsonPath('data.attributes.incidentDescription', 'Original description stays')
        ->assertJsonPath('data.attributes.latitude', '12.5204000')
        ->assertJsonPath('data.attributes.longitude', '121.4392000')
        ->assertJsonPath('data.attributes.locationSource', 'device');

    $this->assertDatabaseHas('fire_reports', [
        'id' => $report->id,
        'incident_description' => 'Original description stays',
        'location_source' => 'device',
    ]);
});

test('updating a report with PATCH rejects unknown or workflow fields', function () {
    $resident = User::factory()->create();
    $report = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'status' => 'pending',
    ]);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->patchJson("/api/v1/reports/{$report->id}", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'status' => 'resolved',
            ],
        ],
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('data.attributes');

    $this->assertDatabaseHas('fire_reports', [
        'id' => $report->id,
        'status' => 'pending',
    ]);
});

test('updating a report with invalid coordinates via PATCH returns 422', function () {
    $resident = User::factory()->create();
    $report = FireReport::factory()->create([
        'resident_id' => $resident->id,
    ]);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->patchJson("/api/v1/reports/{$report->id}", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'latitude' => 150,
            ],
        ],
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'data.attributes.latitude',
        ]);
});

test('resident cannot update another resident report with PATCH', function () {
    $resident = User::factory()->create();
    $otherResident = User::factory()->create();
    $otherReport = FireReport::factory()->create([
        'resident_id' => $otherResident->id,
        'incident_description' => 'Unchanged other description',
    ]);

    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->patchJson("/api/v1/reports/{$otherReport->id}", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Unauthorized patch attempt',
            ],
        ],
    ])
        ->assertNotFound();

    $this->assertDatabaseHas('fire_reports', [
        'id' => $otherReport->id,
        'incident_description' => 'Unchanged other description',
    ]);
});

test('updating non-existent report with PATCH returns 404', function () {
    $resident = User::factory()->create();
    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->patchJson('/api/v1/reports/99999', [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Non existent',
            ],
        ],
    ])
        ->assertNotFound();
});



