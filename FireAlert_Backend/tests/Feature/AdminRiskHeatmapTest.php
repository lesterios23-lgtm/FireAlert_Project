<?php

use App\Models\BarangayRiskReference;
use App\Models\FireReport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

test('admin can fetch seasonal risk heatmap points filtered by dry, wet, and all seasons', function () {
    $resident = User::factory()->create();
    $admin = User::factory()->create(['role' => 'admin']);

    // Dry season (March - May)
    FireReport::factory()->create([
        'resident_id' => $resident->id,
        'incident_address' => 'Mansalay Public Market, Brgy. Poblacion',
        'incident_description' => 'Market stall fire. Estimated fire size: large.',
        'latitude' => 12.5205,
        'longitude' => 121.4385,
        'reported_at' => '2025-03-15 14:20:00',
    ]);
    FireReport::factory()->create([
        'resident_id' => $resident->id,
        'incident_address' => 'Brgy. B. del Mundo Roadside',
        'incident_description' => 'Grass and storage fire. Estimated fire size: medium.',
        'latitude' => 12.5280,
        'longitude' => 121.4420,
        'reported_at' => '2025-05-05 13:30:00',
    ]);

    // Wet season (June - November)
    FireReport::factory()->create([
        'resident_id' => $resident->id,
        'incident_address' => 'Brgy. Santa Teresita Centro',
        'incident_description' => 'Electrical post spark. Estimated fire size: small.',
        'latitude' => 12.5110,
        'longitude' => 121.4310,
        'reported_at' => '2025-08-12 09:15:00',
    ]);

    // Report without coordinates must be excluded
    FireReport::factory()->create([
        'resident_id' => $resident->id,
        'incident_address' => 'Brgy. Balugo',
        'incident_description' => 'No coordinates report.',
        'latitude' => null,
        'longitude' => null,
        'reported_at' => '2025-04-10 10:00:00',
    ]);

    $token = loginToken($admin);

    // Dry season: 2 points with intensities 1.0 (Large) and 0.7 (Medium)
    $dryResponse = $this->withToken($token)
        ->getJson('/api/v1/admin/risk-heatmap?season=dry')
        ->assertOk()
        ->assertJsonPath('data.season', 'dry')
        ->assertJsonPath('data.count', 2);

    $dryPoints = collect($dryResponse->json('data.points'));
    expect($dryPoints->pluck('intensity')->all())->toEqualCanonicalizing([1.0, 0.7]);
    expect($dryPoints->pluck('severity')->all())->toEqualCanonicalizing(['Large', 'Medium']);

    // Wet season: 1 point with intensity 0.4 (Small)
    $this->withToken($token)
        ->getJson('/api/v1/admin/risk-heatmap?season=wet')
        ->assertOk()
        ->assertJsonPath('data.season', 'wet')
        ->assertJsonPath('data.count', 1)
        ->assertJsonPath('data.points.0.severity', 'Small')
        ->assertJsonPath('data.points.0.intensity', 0.4);

    // All seasons: 3 points total
    $this->withToken($token)
        ->getJson('/api/v1/admin/risk-heatmap?season=all')
        ->assertOk()
        ->assertJsonPath('data.season', 'all')
        ->assertJsonPath('data.count', 3);
});

test('non-admin users cannot access seasonal risk heatmap endpoint', function () {
    $resident = User::factory()->create();
    $bfp = User::factory()->manager()->create();

    $this->withToken(loginToken($resident))
        ->getJson('/api/v1/admin/risk-heatmap?season=dry')
        ->assertForbidden();

    $this->withToken(loginToken($bfp))
        ->getJson('/api/v1/admin/risk-heatmap?season=dry')
        ->assertForbidden();
});

test('high-risk prediction uses live weather forecast and returns only high-risk locations for selected day', function () {
    Cache::flush();

    $resident = User::factory()->create();
    $admin = User::factory()->create(['role' => 'admin']);

    BarangayRiskReference::create([
        'barangay_name' => 'Panaytayan',
        'latitude' => 12.5427,
        'longitude' => 121.3334,
        'reference_risk_level' => 'High',
        'verification_status' => 'Supplied initial reference',
    ]);
    BarangayRiskReference::create([
        'barangay_name' => 'Don Pedro',
        'latitude' => 12.4894,
        'longitude' => 121.4241,
        'reference_risk_level' => 'Low',
        'verification_status' => 'Supplied initial reference',
    ]);

    FireReport::factory()->create([
        'resident_id' => $resident->id,
        'incident_address' => 'Brgy. Panaytayan',
        'incident_description' => 'Grass fire. Estimated fire size: large.',
        'latitude' => 12.5427,
        'longitude' => 121.3334,
        'reported_at' => now()->subDays(5),
    ]);

    $dates = collect(range(0, 6))->map(fn ($d) => now('Asia/Manila')->addDays($d)->toDateString())->all();

    // Location 0 (Panaytayan): Day 0 hot/dry/windy -> High; Day 1 heavy rain -> Low
    // Location 1 (Don Pedro): Day 0 rainy/humid -> Low; Day 1 rainy -> Low
    Http::fake([
        'api.open-meteo.com/*' => Http::response([
            [
                'current' => [
                    'temperature_2m' => 35.4,
                    'relative_humidity_2m' => 42,
                    'wind_speed_10m' => 26,
                    'precipitation' => 0.0,
                    'weather_code' => 0,
                ],
                'daily' => [
                    'time' => $dates,
                    'temperature_2m_max' => [35.4, 27.0, 29.0, 30.0, 31.0, 32.0, 33.0],
                    'relative_humidity_2m_min' => [42, 85, 78, 70, 65, 60, 58],
                    'wind_speed_10m_max' => [26.0, 8.0, 10.0, 11.0, 12.0, 14.0, 15.0],
                    'precipitation_sum' => [0.0, 18.0, 12.0, 5.0, 2.0, 1.0, 0.5],
                    'precipitation_probability_max' => [5, 90, 80, 50, 30, 20, 15],
                    'weather_code' => [0, 65, 63, 61, 3, 2, 1],
                ],
            ],
            [
                'current' => [
                    'temperature_2m' => 27.0,
                    'relative_humidity_2m' => 84,
                    'wind_speed_10m' => 8,
                    'precipitation' => 12.0,
                    'weather_code' => 65,
                ],
                'daily' => [
                    'time' => $dates,
                    'temperature_2m_max' => [27.0, 26.5, 28.0, 29.0, 30.0, 31.0, 31.0],
                    'relative_humidity_2m_min' => [84, 88, 80, 75, 72, 70, 68],
                    'wind_speed_10m_max' => [8.0, 7.0, 9.0, 10.0, 10.0, 11.0, 12.0],
                    'precipitation_sum' => [18.0, 20.0, 10.0, 6.0, 3.0, 2.0, 1.0],
                    'precipitation_probability_max' => [90, 95, 75, 50, 40, 30, 20],
                    'weather_code' => [65, 65, 63, 61, 3, 2, 2],
                ],
            ],
        ], 200),
    ]);

    $token = loginToken($admin);

    // Day 0 (Today): only Panaytayan is High Risk
    $todayResponse = $this->withToken($token)
        ->getJson('/api/v1/admin/high-risk-areas?period=365&day=0')
        ->assertOk()
        ->assertJsonPath('data.weather_available', true)
        ->assertJsonPath('data.selected_day_index', 0)
        ->assertJsonCount(7, 'data.forecast_days')
        ->assertJsonCount(2, 'data.daily_predictions')
        ->assertJsonCount(1, 'data.high_risk_locations')
        ->assertJsonPath('data.high_risk_locations.0.barangay_name', 'Panaytayan')
        ->assertJsonPath('data.high_risk_locations.0.predicted_risk_level', 'High');

    expect($todayResponse->json('data.forecast_days.0.high_risk_count'))->toBe(1);
    expect($todayResponse->json('data.forecast_days.1.high_risk_count'))->toBe(0);

    // Day 1 (Tomorrow): heavy rain suppresses both -> 0 High-Risk locations
    $this->withToken($token)
        ->getJson('/api/v1/admin/high-risk-areas?period=365&day=1')
        ->assertOk()
        ->assertJsonPath('data.selected_day_index', 1)
        ->assertJsonCount(0, 'data.high_risk_locations');
});

test('high-risk prediction falls back gracefully when Open-Meteo is unavailable', function () {
    Cache::flush();

    $admin = User::factory()->create(['role' => 'admin']);
    BarangayRiskReference::create([
        'barangay_name' => 'Panaytayan',
        'latitude' => 12.5427,
        'longitude' => 121.3334,
        'reference_risk_level' => 'High',
        'verification_status' => 'Supplied initial reference',
    ]);

    Http::fake([
        'api.open-meteo.com/*' => Http::response([], 500),
    ]);

    $this->withToken(loginToken($admin))
        ->getJson('/api/v1/admin/high-risk-areas?period=365&day=0&refresh=1')
        ->assertOk()
        ->assertJsonPath('data.weather_available', false)
        ->assertJsonCount(7, 'data.forecast_days')
        ->assertJsonCount(1, 'data.daily_predictions');
});
