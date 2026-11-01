<?php

use App\Exceptions\ApiException;
use App\Models\FireReport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route as RouteFacade;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;

uses(RefreshDatabase::class);

// ── Topic 25: Handling Errors ───────────────────────────────────────────────

test('unauthenticated api errors return a consistent JSON envelope', function () {
    $this->getJson('/api/v1/reports')
        ->assertStatus(401)
        ->assertJsonPath('message', 'Unauthenticated.')
        ->assertJsonPath('status', 401);
});

test('a missing model returns a JSON 404 with a safe message', function () {
    $resident = User::factory()->create();
    $token = loginToken($resident);

    $this->withToken($token)->getJson('/api/v1/reports/99999')
        ->assertStatus(404)
        ->assertJsonPath('message', 'Resource not found.')
        ->assertJsonPath('status', 404)
        ->assertJsonMissing(['exception']);
});

test('an unknown api route returns JSON 404 instead of an HTML page', function () {
    $this->getJson('/api/v1/does-not-exist')
        ->assertStatus(404)
        ->assertJsonPath('message', 'Route not found.')
        ->assertJsonPath('status', 404);
});

test('validation failures return 422 with an errors object', function () {
    $resident = User::factory()->create();
    $token = loginToken($resident);

    $this->withToken($token)->postJson('/api/v1/reports', [
        'data' => ['type' => 'fire_report', 'attributes' => []],
    ])
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Validation failed.')
        ->assertJsonPath('status', 422)
        ->assertJsonValidationErrors([
            'data.attributes.incidentDescription',
        ]);
});

test('forbidden actions return a JSON 403 with the policy message', function () {
    $resident = User::factory()->create();
    $other = User::factory()->create();
    $token = loginToken($resident);

    $this->withToken($token)->getJson("/api/v1/users/{$other->id}")
        ->assertForbidden()
        ->assertJsonPath('status', 403);
});

test('a request with malformed JSON body is rejected safely', function () {
    $resident = User::factory()->create();
    $token = loginToken($resident);

    $response = $this->withToken($token)
        ->withHeaders(['Content-Type' => 'application/json'])
        ->call('POST', '/api/v1/reports', [], [], [], [], '{invalid-json');

    // Laravel rejects malformed JSON with a validation error (422) pointing at
    // the whole payload; the guarantee under test is: never a stack trace.
    expect($response->status())->toBe(422);

    if ($response->headers->get('Content-Type') && str_contains($response->headers->get('Content-Type'), 'json')) {
        $body = $response->getContent();

        expect($body)->not->toContain('Stack trace')
            ->and($body)->not->toContain('vendor');
    }
});

test('an unexpected exception returns a generic 500 without internals', function () {
    // Register a throwaway api route that always fails, to observe the handler.
    RouteFacade::get('api/v1/_explode-test', function () {
        throw new RuntimeException('SQL contains secret data and vendor paths');
    })->middleware('api');

    $resident = User::factory()->create();
    $token = loginToken($resident);

    $response = $this->withToken($token)->getJson('/api/v1/_explode-test');

    $response->assertStatus(500)
        ->assertJsonPath('message', 'Server error.')
        ->assertJsonPath('status', 500);

    $body = $response->getContent();

    expect($body)->not->toContain('secret data')
        ->and($body)->not->toContain('Stack trace')
        ->and($body)->not->toContain('RuntimeException');
});

test('ApiException passes its own safe message through', function () {
    RouteFacade::get('api/v1/_api-exception-test', function () {
        throw new ApiException('This user still has fire reports and cannot be deleted.', 409);
    })->middleware('api');

    $resident = User::factory()->create();
    $token = loginToken($resident);

    $this->withToken($token)->getJson('/api/v1/_api-exception-test')
        ->assertStatus(409)
        ->assertJsonPath('message', 'This user still has fire reports and cannot be deleted.')
        ->assertJsonPath('status', 409);
});

test('error responses never include stack traces or vendor paths', function () {
    $resident = User::factory()->create();
    $token = loginToken($resident);

    $responses = [
        $this->withToken($token)->getJson('/api/v1/reports/99999')->getContent(),
        $this->getJson('/api/v1/does-not-exist')->getContent(),
    ];

    foreach ($responses as $body) {
        expect($body)->not->toContain('Stack trace')
            ->and($body)->not->toContain('vendor/');
    }
});
