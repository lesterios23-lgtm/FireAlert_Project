<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;

uses(RefreshDatabase::class);

test('registration creates a resident and returns a JWT', function () {
    $response = $this->postJson('/api/v1/auth/register', [
        'name' => 'Resident Test',
        'email' => 'resident@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
        'role' => User::ROLE_BFP,
    ]);

    $response->assertOk()
        ->assertJsonPath('data.token_type', 'bearer')
        ->assertJsonPath('data.expires_in', 3600);

    $user = User::where('email', 'resident@example.com')->firstOrFail();
    expect($user->role)->toBe(User::ROLE_RESIDENT)
        ->and(Hash::check('password123', $user->password))->toBeTrue();

    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($response->json('data.access_token'))
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.id', $user->id)
        ->assertJsonPath('data.role', User::ROLE_RESIDENT);
});

test('registration validates input and cannot set a privileged role', function () {
    $this->postJson('/api/v1/auth/register', [
        'name' => 'Resident Test',
        'email' => 'invalid',
        'password' => 'short',
        'password_confirmation' => 'different',
        'role' => User::ROLE_BFP,
    ])->assertUnprocessable()
        ->assertJsonValidationErrors(['email', 'password']);

    $this->assertDatabaseCount('users', 0);
});

test('login rejects invalid credentials and returns a JWT for valid credentials', function () {
    $user = User::factory()->create([
        'email' => 'resident@example.com',
        'password' => Hash::make('password123'),
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'incorrect',
    ])->assertUnauthorized()
        ->assertJsonPath('message', 'Invalid credentials');

    $response = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'password123',
    ]);

    $response->assertOk()
        ->assertJsonPath('data.token_type', 'bearer')
        ->assertJsonStructure(['data' => ['access_token', 'token_type', 'expires_in']]);
});

test('logout invalidates the current JWT', function () {
    $user = User::factory()->create();
    $token = Auth::guard('api')->login($user);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)
        ->postJson('/api/v1/auth/logout')
        ->assertOk();

    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)
        ->getJson('/api/v1/auth/me')
        ->assertUnauthorized();
});

test('refresh rotates the JWT and invalidates the previous token', function () {
    $user = User::factory()->create(['password' => Hash::make('password123')]);
    $login = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'password123',
    ])->assertOk();
    $token = $login->json('data.access_token');

    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $response = $this->withoutHeader('Authorization')
        ->withToken($token)
        ->postJson('/api/v1/auth/refresh')
        ->assertOk()
        ->assertJsonStructure(['data' => ['access_token', 'token_type', 'expires_in']]);

    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $newToken = $response->json('data.access_token');
    expect(JWTAuth::setToken($newToken)->check())->toBeTrue();
    JWTAuth::unsetToken();
    expect(JWTAuth::setToken($token)->check())->toBeFalse();
});

test('existing accounts can remain unassigned until an administrator assigns a role', function () {
    $user = User::factory()->create(['role' => null]);

    expect($user->fresh()->role)->toBeNull();
});
