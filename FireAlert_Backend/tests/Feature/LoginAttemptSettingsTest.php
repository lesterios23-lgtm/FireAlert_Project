<?php
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

beforeEach(function () {
    Cache::flush();
});

test('login throttles an email and ip after the configured number of failed attempts', function () {
    $user = User::factory()->create([
        'email' => 'locked@example.com',
        'password' => Hash::make('correct-password'),
    ]);

    for ($attempt = 0; $attempt < 5; $attempt++) {
        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'incorrect-password',
        ])->assertUnauthorized();
    }

    $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'correct-password',
    ])->assertStatus(429)
        ->assertJsonPath('status', 429)
        ->assertJsonPath('message', 'Too many login attempts. Try again in 15 minutes.')
        ->assertHeader('Retry-After');
});

test('system administrators can configure login attempt threshold and lockout duration', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $token = loginToken($admin);

    $this->withToken($token)
        ->putJson('/api/v1/admin/login-attempt-settings', [
            'max_attempts' => 2,
            'lockout_minutes' => 3,
        ])
        ->assertOk()
        ->assertJsonPath('data.max_attempts', 2)
        ->assertJsonPath('data.lockout_minutes', 3);

    expect(app(\App\Services\LoginAttemptSettings::class)->get())
        ->toBe(['max_attempts' => 2, 'lockout_minutes' => 3]);
    $this->assertDatabaseHas('system_settings', [
        'setting_key' => 'login_max_attempts',
        'setting_value' => '2',
    ]);
    $this->assertDatabaseHas('system_settings', [
        'setting_key' => 'login_lockout_minutes',
        'setting_value' => '3',
    ]);
});

test('login attempt settings require an administrator and bounded values', function () {
    $resident = User::factory()->create();
    $token = loginToken($resident);

    $this->withToken($token)
        ->putJson('/api/v1/admin/login-attempt-settings', [
            'max_attempts' => 0,
            'lockout_minutes' => 2000,
        ])
        ->assertForbidden();

    $admin = User::factory()->create(['role' => 'admin']);
    $adminToken = loginToken($admin);

    $this->withToken($adminToken)
        ->putJson('/api/v1/admin/login-attempt-settings', [
            'max_attempts' => 0,
            'lockout_minutes' => 2000,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['max_attempts', 'lockout_minutes']);
});
