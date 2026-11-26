<?php

use App\Models\FireIncident;
use App\Models\FireReport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;

uses(RefreshDatabase::class);

function bfpToken(): string
{
    $bfp = User::factory()->create(['role' => 'bfp']);
    $token = Auth::guard('api')->login($bfp);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    return $token;
}

function residentToken(?User $resident = null): array
{
    $resident ??= User::factory()->create(['role' => 'resident']);
    $token = Auth::guard('api')->login($resident);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    return [$token, $resident];
}

function postReport(string $token, array $attributes)
{
    return test()->withToken($token)->postJson('/api/v1/reports', [
        'data' => [
            'type' => 'fire_report',
            'attributes' => $attributes,
        ],
    ]);
}

test('first report creates a new official incident', function () {
    [$token] = residentToken();

    $response = postReport($token, [
        'incidentDescription' => 'House on fire near the chapel. Estimated fire size: medium.',
        'incidentAddress' => 'Purok 3, Brgy. Poblacion, Mansalay, Oriental Mindoro',
        'latitude' => 12.5204,
        'longitude' => 121.4392,
        'locationSource' => 'manual',
    ]);

    $response->assertCreated();
    $reportId = $response->json('data.id');

    $this->assertDatabaseHas('fire_incidents', ['code' => 'INC-001']);
    $incident = FireIncident::where('code', 'INC-001')->firstOrFail();
    expect($incident->reports()->count())->toBe(1);
    expect($response->json('meta.grouping.fireIncidentCode'))->toBe('INC-001');
    expect(FireReport::find($reportId)->duplicate_flag)->toBe('anchor');
});

test('second report for the same location and time is blocked as already reported', function () {
    [$tokenA] = residentToken();
    [$tokenB] = residentToken();

    postReport($tokenA, [
        'incidentDescription' => 'Big house fire spreading fast. Estimated fire size: large.',
        'incidentAddress' => 'Purok 3, Brgy. Poblacion, Mansalay, Oriental Mindoro',
        'latitude' => 12.5204,
        'longitude' => 121.4392,
        'locationSource' => 'manual',
    ])->assertCreated();

    $second = postReport($tokenB, [
        'incidentDescription' => 'House fire still burning near our place. Estimated fire size: large.',
        'incidentAddress' => 'Purok 3, Brgy. Poblacion, Mansalay, Oriental Mindoro',
        'latitude' => 12.5205,
        'longitude' => 121.4393,
        'locationSource' => 'device',
    ]);

    $second->assertStatus(409)
        ->assertJsonPath('data.alreadyReported', true)
        ->assertJsonPath('data.incidentCode', 'INC-001');
    expect(strtolower((string) $second->json('message')))->toContain('already reported');

    // Only the first report and single official incident exist.
    expect(FireIncident::count())->toBe(1);
    expect(FireReport::count())->toBe(1);
});

test('same address without GPS within time window is also blocked as already reported', function () {
    [$tokenA] = residentToken();
    [$tokenB] = residentToken();

    postReport($tokenA, [
        'incidentDescription' => 'Kitchen fire in market stall. Estimated fire size: small.',
        'incidentAddress' => 'Purok 1, Brgy. Roma, Mansalay, Oriental Mindoro',
    ])->assertCreated();

    $second = postReport($tokenB, [
        'incidentDescription' => 'Smoke seen from market stall. Estimated fire size: medium.',
        'incidentAddress' => 'Purok 1, Brgy. Roma, Mansalay, Oriental Mindoro',
    ]);

    $second->assertStatus(409)
        ->assertJsonPath('data.alreadyReported', true);
    expect(FireReport::count())->toBe(1);
    expect(FireIncident::count())->toBe(1);
});

test('distant report creates its own incident', function () {
    [$tokenA] = residentToken();
    [$tokenB] = residentToken();

    postReport($tokenA, [
        'incidentDescription' => 'House fire in Poblacion. Estimated fire size: medium.',
        'incidentAddress' => 'Brgy. Poblacion, Mansalay, Oriental Mindoro',
        'latitude' => 12.5204,
        'longitude' => 121.4392,
        'locationSource' => 'manual',
    ])->assertCreated();

    // ~5 km away: outside the 200 m radius.
    $far = postReport($tokenB, [
        'incidentDescription' => 'Grass fire near the hills. Estimated fire size: medium.',
        'incidentAddress' => 'Brgy. Wasig, Mansalay, Oriental Mindoro',
        'latitude' => 12.5600,
        'longitude' => 121.4800,
        'locationSource' => 'manual',
    ])->assertCreated();

    expect(FireIncident::count())->toBe(2);
    expect($far->json('meta.grouping.fireIncidentCode'))->toBe('INC-002');
});

test('new report at the same location is allowed after the previous incident is resolved', function () {
    [$tokenA] = residentToken();
    [$tokenB] = residentToken();
    $bfp = bfpToken();

    $first = postReport($tokenA, [
        'incidentDescription' => 'Electrical pole fire. Estimated fire size: small.',
        'incidentAddress' => 'Purok 2, Brgy. Teresita, Mansalay, Oriental Mindoro',
        'latitude' => 12.5310,
        'longitude' => 121.4410,
        'locationSource' => 'manual',
    ])->assertCreated();

    $incident = FireIncident::where('code', 'INC-001')->firstOrFail();
    $this->withToken($bfp)
        ->patchJson("/api/v1/incidents/{$incident->id}/status", ['status' => 'resolved'])
        ->assertOk();

    // A later incident at the same location after resolution is accepted cleanly.
    postReport($tokenB, [
        'incidentDescription' => 'New electrical fire reported later. Estimated fire size: medium.',
        'incidentAddress' => 'Purok 2, Brgy. Teresita, Mansalay, Oriental Mindoro',
        'latitude' => 12.5310,
        'longitude' => 121.4410,
        'locationSource' => 'manual',
    ])->assertCreated();

    expect(FireReport::count())->toBe(2);
    expect(FireIncident::count())->toBe(2);
    expect($first->json('data.id'))->not->toBeNull();
});

test('manual merge, attach, and detach endpoints are no longer registered', function () {
    [$tokenA] = residentToken();
    $bfp = bfpToken();

    $created = postReport($tokenA, [
        'incidentDescription' => 'House fire. Estimated fire size: medium.',
        'incidentAddress' => 'Brgy. Poblacion, Mansalay, Oriental Mindoro',
        'latitude' => 12.5204,
        'longitude' => 121.4392,
        'locationSource' => 'manual',
    ])->assertCreated();

    $reportId = $created->json('data.id');
    $incident = FireIncident::where('code', 'INC-001')->firstOrFail();

    $mergeResponse = $this->withToken($bfp)->postJson("/api/v1/incidents/{$incident->id}/merge", ['into_incident_id' => $incident->id]);
    $attachResponse = $this->withToken($bfp)->postJson("/api/v1/incidents/{$incident->id}/reports/{$reportId}/attach");
    $detachResponse = $this->withToken($bfp)->postJson("/api/v1/reports/{$reportId}/detach");

    expect(in_array($mergeResponse->getStatusCode(), [404, 405], true))->toBeTrue();
    expect(in_array($attachResponse->getStatusCode(), [404, 405], true))->toBeTrue();
    expect(in_array($detachResponse->getStatusCode(), [404, 405], true))->toBeTrue();
});
