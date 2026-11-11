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

test('second nearby report within the time window auto-attaches to the same incident', function () {
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
    ])->assertCreated();

    expect(FireIncident::count())->toBe(1);
    expect($second->json('meta.grouping.fireIncidentCode'))->toBe('INC-001');
    expect($second->json('meta.grouping.verdict'))->toBe('strong');
    $incident = FireIncident::where('code', 'INC-001')->firstOrFail();
    expect($incident->reports()->count())->toBe(2);

    // Both resident submissions are preserved individually.
    expect(FireReport::count())->toBe(2);
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

test('uncertain nearby report is flagged possible duplicate for BFP verification', function () {
    [$tokenA] = residentToken();
    [$tokenB] = residentToken();

    postReport($tokenA, [
        'incidentDescription' => 'Kitchen fire with thick smoke. Estimated fire size: small.',
        'incidentAddress' => 'Purok 1, Brgy. Roma, Mansalay, Oriental Mindoro',
        'latitude' => 12.5210,
        'longitude' => 121.4400,
        'locationSource' => 'manual',
    ])->assertCreated();

    // Same ~100 m area and window, but unrelated description and different size.
    $uncertain = postReport($tokenB, [
        'incidentDescription' => 'Loud explosion and sparks from a transformer post.',
        'incidentAddress' => 'Near the waiting shed, Roma area',
        'latitude' => 12.5215,
        'longitude' => 121.4406,
        'locationSource' => 'manual',
    ])->assertCreated();

    expect($uncertain->json('meta.grouping.verdict'))->toBe('possible');
    $reportId = $uncertain->json('data.id');
    expect(FireReport::find($reportId)->duplicate_flag)->toBe('possible');
});

test('BFP can attach, separate and merge incidents with an audit trail', function () {
    [$tokenA] = residentToken();
    [$tokenB] = residentToken();
    $bfp = bfpToken();

    postReport($tokenA, [
        'incidentDescription' => 'House fire spreading. Estimated fire size: large.',
        'incidentAddress' => 'Brgy. Poblacion, Mansalay, Oriental Mindoro',
        'latitude' => 12.5204,
        'longitude' => 121.4392,
        'locationSource' => 'manual',
    ])->assertCreated();

    $farResponse = postReport($tokenB, [
        'incidentDescription' => 'Warehouse fire far away. Estimated fire size: large.',
        'incidentAddress' => 'Brgy. Wasig, Mansalay, Oriental Mindoro',
        'latitude' => 12.5700,
        'longitude' => 121.4900,
        'locationSource' => 'manual',
    ])->assertCreated();
    $farReportId = $farResponse->json('data.id');

    $first = FireIncident::where('code', 'INC-001')->firstOrFail();
    $second = FireIncident::where('code', 'INC-002')->firstOrFail();

    // Manual attach: BFP confirms the far report is the same fire after all.
    $this->withToken($bfp)
        ->postJson("/api/v1/incidents/{$first->id}/reports/{$farReportId}/attach", ['reason' => 'Same fire confirmed on site'])
        ->assertOk();
    expect(FireReport::find($farReportId)->fire_incident_id)->toBe($first->id);

    // Separate it back out: new standalone incident is created.
    $this->withToken($bfp)
        ->postJson("/api/v1/reports/{$farReportId}/detach", ['reason' => 'Actually a different fire'])
        ->assertOk()
        ->assertJsonPath('data.incident.attributes.code', 'INC-003');
    expect(FireReport::find($farReportId)->duplicate_flag)->toBe('separated');

    // Merge INC-003 back into INC-001.
    $split = FireIncident::where('code', 'INC-003')->firstOrFail();
    $this->withToken($bfp)
        ->postJson("/api/v1/incidents/{$split->id}/merge", [
            'into_incident_id' => $first->id,
            'reason' => 'Same origin after investigation',
        ])->assertOk();
    expect(FireReport::find($farReportId)->fresh()->fire_incident_id)->toBe($first->id);

    // Every manual action is recorded.
    expect(\App\Models\FireIncidentAction::count())->toBeGreaterThanOrEqual(4);
});

test('BFP incident list groups reports under main incidents', function () {
    [$tokenA] = residentToken();
    [$tokenB] = residentToken();
    $bfp = bfpToken();

    postReport($tokenA, [
        'incidentDescription' => 'House fire spreading. Estimated fire size: large.',
        'incidentAddress' => 'Brgy. Poblacion, Mansalay, Oriental Mindoro',
        'latitude' => 12.5204,
        'longitude' => 121.4392,
        'locationSource' => 'manual',
    ])->assertCreated();

    postReport($tokenB, [
        'incidentDescription' => 'Same house fire getting bigger. Estimated fire size: large.',
        'incidentAddress' => 'Brgy. Poblacion, Mansalay, Oriental Mindoro',
        'latitude' => 12.52045,
        'longitude' => 121.43925,
        'locationSource' => 'manual',
    ])->assertCreated();

    $this->withToken($bfp)->getJson('/api/v1/incidents')
        ->assertOk()
        ->assertJsonPath('data.incidents.0.type', 'fire_incident')
        ->assertJsonPath('data.incidents.0.attributes.code', 'INC-001')
        ->assertJsonPath('data.incidents.0.attributes.reportCount', 2);
});
