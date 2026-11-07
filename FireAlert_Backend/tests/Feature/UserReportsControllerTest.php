<?php

use App\Models\FireReport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ── Topic 22: Implementing the Users Reports Controller ─────────────────────

// ── POST: creating a report through the nested route ────────────────────────

test('creating a report through the nested route requires authentication', function () {
    $resident = User::factory()->create();

    $this->postJson("/api/v1/users/{$resident->id}/reports", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Smoke in the hallway.',
                'incidentAddress' => 'Mansalay Central Market',
            ],
        ],
    ])->assertUnauthorized();
});

test('authenticated resident can create their own report through the nested route', function () {
    $resident = User::factory()->create();
    $token = loginToken($resident);

    $this->withToken($token)->postJson("/api/v1/users/{$resident->id}/reports", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Smoke in the hallway.',
                'incidentAddress' => 'Mansalay Central Market',
            ],
        ],
    ])
        ->assertCreated()
        ->assertJsonPath('data.type', 'fire_report')
        ->assertJsonPath('data.attributes.incidentDescription', 'Smoke in the hallway.')
        ->assertJsonPath('data.attributes.status', 'pending')
        ->assertJsonPath('data.relationships.resident.data.id', $resident->id);

    $this->assertDatabaseHas('fire_reports', [
        'resident_id' => $resident->id,
        'incident_description' => 'Smoke in the hallway.',
        'status' => 'pending',
    ]);
});

test('resident cannot create a report through another resident nested route', function () {
    $resident = User::factory()->create();
    $otherResident = User::factory()->create();
    $token = loginToken($resident);

    // The nested store request forces the URL resident onto the report, so a
    // resident posting to another user's route would create a report for
    // someone else. The store policy still fires, but ownership is forced:
    // the report created must belong to the URL user, so this is rejected by
    // the resident-id size rule.
    $this->withToken($token)->postJson("/api/v1/users/{$otherResident->id}/reports", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Report for someone else.',
                'incidentAddress' => 'Barangay Hall',
            ],
        ],
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['data.relationships.resident.data.id']);

    $this->assertDatabaseCount('fire_reports', 0);
});

test('manager can create a report for any resident through the nested route', function () {
    $manager = User::factory()->manager()->create();
    $resident = User::factory()->create();
    $token = loginToken($manager);

    $this->withToken($token)->postJson("/api/v1/users/{$resident->id}/reports", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Manager-logged incident for resident.',
                'incidentAddress' => 'Barangay Hall',
            ],
        ],
    ])
        ->assertCreated()
        ->assertJsonPath('data.relationships.resident.data.id', $resident->id);

    $this->assertDatabaseHas('fire_reports', [
        'resident_id' => $resident->id,
        'incident_description' => 'Manager-logged incident for resident.',
        'status' => 'pending',
    ]);
});

test('nested report creation validates required incident details', function () {
    $resident = User::factory()->create();
    $token = loginToken($resident);

    $this->withToken($token)->postJson("/api/v1/users/{$resident->id}/reports", [
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

// ── PUT: replacing a report through the nested route ────────────────────────

test('resident cannot replace a report through the nested route with PUT', function () {
    $resident = User::factory()->create();
    $report = FireReport::factory()->create(['resident_id' => $resident->id]);
    $token = loginToken($resident);

    $this->withToken($token)->putJson("/api/v1/users/{$resident->id}/reports/{$report->id}", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Resident attempt to PUT.',
                'incidentAddress' => 'Mansalay Market',
            ],
        ],
    ])
        ->assertForbidden()
        ->assertJsonPath('message', 'You are not authorized to replace that resource.');

    $this->assertDatabaseHas('fire_reports', [
        'id' => $report->id,
        'incident_description' => $report->incident_description,
    ]);
});

test('manager can replace a resident report through the nested route with PUT', function () {
    $manager = User::factory()->manager()->create();
    $resident = User::factory()->create();
    $report = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'incident_description' => 'Original description',
        'incident_address' => 'Original address',
        'latitude' => null,
        'longitude' => null,
        'location_source' => null,
    ]);
    $token = loginToken($manager);

    $this->withToken($token)->putJson("/api/v1/users/{$resident->id}/reports/{$report->id}", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Replaced through the nested route.',
                'latitude' => 12.5204,
                'longitude' => 121.4392,
                'locationSource' => 'manual',
            ],
        ],
    ])
        ->assertOk()
        ->assertJsonPath('data.attributes.incidentDescription', 'Replaced through the nested route.')
        ->assertJsonPath('data.attributes.incidentAddress', null)
        ->assertJsonPath('data.attributes.latitude', '12.5204000');

    $this->assertDatabaseHas('fire_reports', [
        'id' => $report->id,
        'incident_description' => 'Replaced through the nested route.',
        'incident_address' => null,
    ]);
});

test('replacing through the nested route requires all mandatory fields', function () {
    $manager = User::factory()->manager()->create();
    $resident = User::factory()->create();
    $report = FireReport::factory()->create(['resident_id' => $resident->id]);
    $token = loginToken($manager);

    $this->withToken($token)->putJson("/api/v1/users/{$resident->id}/reports/{$report->id}", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentAddress' => 'Only an address',
            ],
        ],
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['data.attributes.incidentDescription']);
});

// ── PATCH: updating a report through the nested route ───────────────────────

test('authenticated resident can partially update their report through the nested route', function () {
    $resident = User::factory()->create();
    $report = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'incident_description' => 'Original description',
        'incident_address' => 'Mansalay Market',
    ]);
    $token = loginToken($resident);

    $this->withToken($token)->patchJson("/api/v1/users/{$resident->id}/reports/{$report->id}", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Patched through the nested route.',
            ],
        ],
    ])
        ->assertOk()
        ->assertJsonPath('data.attributes.incidentDescription', 'Patched through the nested route.')
        ->assertJsonPath('data.attributes.incidentAddress', 'Mansalay Market');

    $this->assertDatabaseHas('fire_reports', [
        'id' => $report->id,
        'incident_description' => 'Patched through the nested route.',
        'incident_address' => 'Mansalay Market',
    ]);
});

test('resident cannot update another resident report through the nested route', function () {
    $resident = User::factory()->create();
    $otherResident = User::factory()->create();
    $otherReport = FireReport::factory()->create([
        'resident_id' => $otherResident->id,
        'incident_description' => 'Unchanged description',
    ]);
    $token = loginToken($resident);

    $this->withToken($token)->patchJson("/api/v1/users/{$otherResident->id}/reports/{$otherReport->id}", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Unauthorized patch attempt.',
            ],
        ],
    ])
        ->assertForbidden()
        ->assertJsonPath('message', 'You are not authorized to update that resource.');

    $this->assertDatabaseHas('fire_reports', [
        'id' => $otherReport->id,
        'incident_description' => 'Unchanged description',
    ]);
});

test('updating through the nested route rejects workflow fields', function () {
    $resident = User::factory()->create();
    $report = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'status' => 'pending',
    ]);
    $token = loginToken($resident);

    $this->withToken($token)->patchJson("/api/v1/users/{$resident->id}/reports/{$report->id}", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Trying to change status.',
                'status' => 'resolved',
            ],
        ],
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('data.attributes.status');

    $this->assertDatabaseHas('fire_reports', [
        'id' => $report->id,
        'status' => 'pending',
    ]);
});

test('manager can update a resident report through the nested route with PATCH', function () {
    $manager = User::factory()->manager()->create();
    $resident = User::factory()->create();
    $report = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'incident_description' => 'Resident report',
    ]);
    $token = loginToken($manager);

    $this->withToken($token)->patchJson("/api/v1/users/{$resident->id}/reports/{$report->id}", [
        'data' => [
            'type' => 'fire_report',
            'attributes' => [
                'incidentDescription' => 'Manager patched the resident report.',
            ],
        ],
    ])
        ->assertOk()
        ->assertJsonPath('data.attributes.incidentDescription', 'Manager patched the resident report.');
});

// ── DELETE: deleting a report through the nested route ──────────────────────

test('authenticated resident can delete their own report through the nested route', function () {
    $resident = User::factory()->create();
    $report = FireReport::factory()->create(['resident_id' => $resident->id]);
    $token = loginToken($resident);

    $this->withToken($token)->deleteJson("/api/v1/users/{$resident->id}/reports/{$report->id}")
        ->assertOk()
        ->assertJsonPath('message', 'Report successfully deleted');

    $this->assertDatabaseMissing('fire_reports', ['id' => $report->id]);
});

test('resident cannot delete another resident report through the nested route', function () {
    $resident = User::factory()->create();
    $otherResident = User::factory()->create();
    $otherReport = FireReport::factory()->create(['resident_id' => $otherResident->id]);
    $token = loginToken($resident);

    $this->withToken($token)->deleteJson("/api/v1/users/{$otherResident->id}/reports/{$otherReport->id}")
        ->assertForbidden()
        ->assertJsonPath('message', 'You are not authorized to delete that resource.');

    $this->assertDatabaseHas('fire_reports', ['id' => $otherReport->id]);
});

test('manager can delete a resident report through the nested route', function () {
    $manager = User::factory()->manager()->create();
    $resident = User::factory()->create();
    $report = FireReport::factory()->create(['resident_id' => $resident->id]);
    $token = loginToken($manager);

    $this->withToken($token)->deleteJson("/api/v1/users/{$resident->id}/reports/{$report->id}")
        ->assertOk()
        ->assertJsonPath('message', 'Report successfully deleted');

    $this->assertDatabaseMissing('fire_reports', ['id' => $report->id]);
});

test('deleting a non-existent report through the nested route returns 404', function () {
    $resident = User::factory()->create();
    $token = loginToken($resident);

    $this->withToken($token)->deleteJson("/api/v1/users/{$resident->id}/reports/99999")
        ->assertNotFound();
});

// ── GET index regression through the nested route ───────────────────────────

test('nested report list requires authentication', function () {
    $resident = User::factory()->create();

    $this->getJson("/api/v1/users/{$resident->id}/reports")
        ->assertUnauthorized();
});

test('nested report list returns 404 when the route user is not the authenticated user', function () {
    $resident = User::factory()->create();
    $otherResident = User::factory()->create();
    FireReport::factory()->create(['resident_id' => $otherResident->id]);
    $token = loginToken($resident);

    $this->withToken($token)->getJson("/api/v1/users/{$otherResident->id}/reports")
        ->assertNotFound();
});

test('nested report list returns only the route user reports', function () {
    $resident = User::factory()->create();
    $ownReport = FireReport::factory()->create(['resident_id' => $resident->id]);
    FireReport::factory()->create(['resident_id' => User::factory()->create()->id]);
    $token = loginToken($resident);

    $this->withToken($token)->getJson("/api/v1/users/{$resident->id}/reports")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $ownReport->id)
        ->assertJsonPath('data.0.relationships.resident.data.id', $resident->id)
        ->assertJsonPath('meta.total', 1);
});

test('nested report list applies filters and pagination', function () {
    $resident = User::factory()->create();
    $pending = FireReport::factory()->create([
        'resident_id' => $resident->id,
        'status' => 'pending',
    ]);
    FireReport::factory()->create([
        'resident_id' => $resident->id,
        'status' => 'resolved',
    ]);
    $token = loginToken($resident);

    $this->withToken($token)->getJson("/api/v1/users/{$resident->id}/reports?status=pending")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $pending->id)
        ->assertJsonPath('meta.total', 1);
});
