<?php

use App\Models\FireReport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;

uses(RefreshDatabase::class);

// ── Topic 23: Managing Users ────────────────────────────────────────────────

function userAttributes(array $overrides = []): array
{
    return array_merge([
        'name' => 'Managed Resident',
        'email' => 'managed.resident@example.com',
        'password' => 'SecurePass123',
        'role' => User::ROLE_RESIDENT,
    ], $overrides);
}

function createUserPayload(array $attributes): array
{
    return ['data' => ['type' => 'user', 'attributes' => $attributes]];
}

// ── Authentication ──────────────────────────────────────────────────────────

test('user management requires authentication', function () {
    User::factory()->count(2)->create();

    $this->getJson('/api/v1/users')->assertUnauthorized();
});

// ── Residents are denied ────────────────────────────────────────────────────

test('resident cannot list users', function () {
    $resident = User::factory()->create();
    $token = loginToken($resident);

    $this->withToken($token)->getJson('/api/v1/users')
        ->assertForbidden()
        ->assertJsonPath('message', 'You are not authorized to view that resource.');
});

test('resident cannot create a user account', function () {
    $resident = User::factory()->create();
    $token = loginToken($resident);

    $this->withToken($token)->postJson('/api/v1/users', createUserPayload(userAttributes()))
        ->assertForbidden()
        ->assertJsonPath('message', 'You are not authorized to create that resource.');

    $this->assertDatabaseCount('users', 1);
});

test('resident cannot view a single user', function () {
    $resident = User::factory()->create();
    $other = User::factory()->create();
    $token = loginToken($resident);

    $this->withToken($token)->getJson("/api/v1/users/{$other->id}")
        ->assertForbidden();
});

test('resident cannot replace a user', function () {
    $resident = User::factory()->create();
    $other = User::factory()->create();
    $token = loginToken($resident);

    $this->withToken($token)->putJson("/api/v1/users/{$other->id}", createUserPayload(userAttributes()))
        ->assertForbidden();
});

test('resident cannot update a user', function () {
    $resident = User::factory()->create();
    $other = User::factory()->create(['name' => 'Original Name']);
    $token = loginToken($resident);

    $this->withToken($token)->patchJson("/api/v1/users/{$other->id}", createUserPayload([
        'name' => 'Hacked Name',
    ]))
        ->assertForbidden();

    $this->assertDatabaseHas('users', ['id' => $other->id, 'name' => 'Original Name']);
});

test('resident cannot delete a user', function () {
    $resident = User::factory()->create();
    $other = User::factory()->create();
    $token = loginToken($resident);

    $this->withToken($token)->deleteJson("/api/v1/users/{$other->id}")
        ->assertForbidden();

    $this->assertDatabaseHas('users', ['id' => $other->id]);
});

// ── Manager: list & show ────────────────────────────────────────────────────

test('manager can list users with safe fields only', function () {
    $manager = User::factory()->manager()->create();
    User::factory()->count(3)->create();
    $token = loginToken($manager);

    $this->withToken($token)->getJson('/api/v1/users')
        ->assertOk()
        ->assertJsonCount(4, 'data')
        ->assertJsonPath('meta.total', 4)
        ->assertJsonPath('data.0.type', 'user')
        ->assertJsonMissing(['password'])
        ->assertJsonMissing(['remember_token']);
});

test('manager can show a single user', function () {
    $manager = User::factory()->manager()->create();
    $resident = User::factory()->create();
    $token = loginToken($manager);

    $this->withToken($token)->getJson("/api/v1/users/{$resident->id}")
        ->assertOk()
        ->assertJsonPath('data.id', $resident->id)
        ->assertJsonPath('data.attributes.email', $resident->email)
        ->assertJsonMissing(['password']);
});

test('showing a non-existent user returns 404', function () {
    $manager = User::factory()->manager()->create();
    $token = loginToken($manager);

    $this->withToken($token)->getJson('/api/v1/users/99999')
        ->assertNotFound();
});

// ── Manager: create ─────────────────────────────────────────────────────────

test('manager can create a resident account and the password is hashed', function () {
    $manager = User::factory()->manager()->create();
    $token = loginToken($manager);

    $this->withToken($token)->postJson('/api/v1/users', createUserPayload(userAttributes()))
        ->assertCreated()
        ->assertJsonPath('data.type', 'user')
        ->assertJsonPath('data.attributes.name', 'Managed Resident')
        ->assertJsonPath('data.attributes.email', 'managed.resident@example.com')
        ->assertJsonPath('data.attributes.role', User::ROLE_RESIDENT)
        ->assertJsonMissing(['password']);

    $created = User::query()->where('email', 'managed.resident@example.com')->first();
    $this->assertNotNull($created);
    $this->assertNotEquals('SecurePass123', $created->password);
    $this->assertDatabaseHas('users', ['email' => 'managed.resident@example.com', 'is_manager' => false]);
});

test('manager can create a BFP personnel account', function () {
    $manager = User::factory()->manager()->create();
    $token = loginToken($manager);

    $this->withToken($token)->postJson('/api/v1/users', createUserPayload(userAttributes([
        'email' => 'bfp.personnel@example.com',
        'role' => User::ROLE_BFP,
    ])))
        ->assertCreated()
        ->assertJsonPath('data.attributes.role', User::ROLE_BFP);

    $this->assertDatabaseHas('users', ['email' => 'bfp.personnel@example.com', 'role' => User::ROLE_BFP]);
});

test('user creation rejects a duplicate email', function () {
    $manager = User::factory()->manager()->create();
    User::factory()->create(['email' => 'taken@example.com']);
    $token = loginToken($manager);

    $this->withToken($token)->postJson('/api/v1/users', createUserPayload(userAttributes([
        'email' => 'taken@example.com',
    ])))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['data.attributes.email']);
});

test('user creation validates required fields', function () {
    $manager = User::factory()->manager()->create();
    $token = loginToken($manager);

    $this->withToken($token)->postJson('/api/v1/users', [
        'data' => ['type' => 'user', 'attributes' => []],
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'data.attributes.name',
            'data.attributes.email',
            'data.attributes.password',
            'data.attributes.role',
        ]);
});

test('user creation rejects a password shorter than 8 characters', function () {
    $manager = User::factory()->manager()->create();
    $token = loginToken($manager);

    $this->withToken($token)->postJson('/api/v1/users', createUserPayload(userAttributes([
        'password' => 'short',
    ])))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['data.attributes.password']);
});

test('user creation rejects an unknown role', function () {
    $manager = User::factory()->manager()->create();
    $token = loginToken($manager);

    $this->withToken($token)->postJson('/api/v1/users', createUserPayload(userAttributes([
        'role' => 'admin',
    ])))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['data.attributes.role']);
});

// ── Manager: replace (PUT) ──────────────────────────────────────────────────

test('manager can replace a user account', function () {
    $manager = User::factory()->manager()->create();
    $resident = User::factory()->create([
        'name' => 'Old Name',
        'email' => 'old@example.com',
        'password' => 'OldPassword1',
    ]);
    $token = loginToken($manager);

    $this->withToken($token)->putJson("/api/v1/users/{$resident->id}", createUserPayload(userAttributes([
        'name' => 'Replaced Name',
        'email' => 'replaced@example.com',
        'password' => 'NewPassword1',
    ])))
        ->assertOk()
        ->assertJsonPath('data.attributes.name', 'Replaced Name')
        ->assertJsonPath('data.attributes.email', 'replaced@example.com');

    $replaced = User::query()->find($resident->id);
    $this->assertNotEquals('NewPassword1', $replaced->password);
});

test('replacing a user requires all mandatory fields', function () {
    $manager = User::factory()->manager()->create();
    $resident = User::factory()->create();
    $token = loginToken($manager);

    $this->withToken($token)->putJson("/api/v1/users/{$resident->id}", createUserPayload([
        'name' => 'Only a name',
    ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'data.attributes.email',
            'data.attributes.password',
            'data.attributes.role',
        ]);
});

// ── Manager: update (PATCH) ─────────────────────────────────────────────────

test('manager can partially update a user account', function () {
    $manager = User::factory()->manager()->create();
    $resident = User::factory()->create([
        'name' => 'Original Name',
        'email' => 'original@example.com',
    ]);
    $token = loginToken($manager);

    $this->withToken($token)->patchJson("/api/v1/users/{$resident->id}", createUserPayload([
        'name' => 'Partially Updated',
    ]))
        ->assertOk()
        ->assertJsonPath('data.attributes.name', 'Partially Updated')
        ->assertJsonPath('data.attributes.email', 'original@example.com');

    $this->assertDatabaseHas('users', ['id' => $resident->id, 'email' => 'original@example.com']);
});

test('manager can promote an account to BFP personnel with PATCH', function () {
    $manager = User::factory()->manager()->create();
    $resident = User::factory()->create();
    $token = loginToken($manager);

    $this->withToken($token)->patchJson("/api/v1/users/{$resident->id}", createUserPayload([
        'role' => User::ROLE_BFP,
    ]))
        ->assertOk()
        ->assertJsonPath('data.attributes.role', User::ROLE_BFP);

    $this->assertDatabaseHas('users', ['id' => $resident->id, 'role' => User::ROLE_BFP]);
});

test('updating a user cannot reuse another user email', function () {
    $manager = User::factory()->manager()->create();
    $resident = User::factory()->create();
    $other = User::factory()->create(['email' => 'other@example.com']);
    $token = loginToken($manager);

    $this->withToken($token)->patchJson("/api/v1/users/{$resident->id}", createUserPayload([
        'email' => 'other@example.com',
    ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['data.attributes.email']);
});

// ── Manager: delete ─────────────────────────────────────────────────────────

test('manager can delete a user account', function () {
    $manager = User::factory()->manager()->create();
    $resident = User::factory()->create();
    $token = loginToken($manager);

    $this->withToken($token)->deleteJson("/api/v1/users/{$resident->id}")
        ->assertOk()
        ->assertJsonPath('message', 'User successfully deleted');

    $this->assertDatabaseMissing('users', ['id' => $resident->id]);
});

test('deleting a non-existent user returns 404', function () {
    $manager = User::factory()->manager()->create();
    $token = loginToken($manager);

    $this->withToken($token)->deleteJson('/api/v1/users/99999')
        ->assertNotFound();
});

test('deleting a user who still owns reports returns 409 and keeps the records', function () {
    $manager = User::factory()->manager()->create();
    $resident = User::factory()->create();
    $report = FireReport::factory()->create(['resident_id' => $resident->id]);
    $token = loginToken($manager);

    $this->withToken($token)->deleteJson("/api/v1/users/{$resident->id}")
        ->assertStatus(409)
        ->assertJsonPath('message', 'This user still has fire reports and cannot be deleted.');

    $this->assertDatabaseHas('users', ['id' => $resident->id]);
    $this->assertDatabaseHas('fire_reports', ['id' => $report->id]);
});

test('deleting a user without reports succeeds', function () {
    $manager = User::factory()->manager()->create();
    $resident = User::factory()->create();
    $token = loginToken($manager);

    $this->withToken($token)->deleteJson("/api/v1/users/{$resident->id}")
        ->assertOk()
        ->assertJsonPath('message', 'User successfully deleted');

    $this->assertDatabaseMissing('users', ['id' => $resident->id]);
});

// ── Topic 24: The Principle of Least Privilege ──────────────────────────────

test('manager cannot replace their own account with PUT', function () {
    $manager = User::factory()->manager()->create();
    $token = loginToken($manager);

    $this->withToken($token)->putJson("/api/v1/users/{$manager->id}", createUserPayload(userAttributes([
        'email' => 'self.replaced@example.com',
    ])))
        ->assertForbidden()
        ->assertJsonPath('message', 'You are not authorized to replace that resource.');

    $this->assertDatabaseHas('users', ['id' => $manager->id, 'email' => $manager->email]);
});

test('manager cannot update their own account with PATCH', function () {
    $manager = User::factory()->manager()->create(['name' => 'Manager Self']);
    $token = loginToken($manager);

    $this->withToken($token)->patchJson("/api/v1/users/{$manager->id}", createUserPayload([
        'name' => 'Self Renamed',
    ]))
        ->assertForbidden();

    $this->assertDatabaseHas('users', ['id' => $manager->id, 'name' => 'Manager Self']);
});

test('manager cannot delete their own account', function () {
    $manager = User::factory()->manager()->create();
    $token = loginToken($manager);

    $this->withToken($token)->deleteJson("/api/v1/users/{$manager->id}")
        ->assertForbidden()
        ->assertJsonPath('message', 'You are not authorized to delete that resource.');

    $this->assertDatabaseHas('users', ['id' => $manager->id]);
});

test('user JSON never exposes the management flag', function () {
    $manager = User::factory()->manager()->create();
    $resident = User::factory()->create(['is_manager' => false]);
    $token = loginToken($manager);

    $this->withToken($token)->getJson("/api/v1/users/{$resident->id}")
        ->assertOk()
        ->assertJsonMissingPath('data.attributes.isManager');
});

test('residents receive no user management abilities in their token', function () {
    $resident = User::factory()->create();

    $claims = $resident->getJWTCustomClaims();

    expect($claims['abilities'])->not->toContain(
        'user:create', 'user:update', 'user:replace', 'user:delete', 'user:manage',
    );
});

test('bfp personnel hold report and account abilities plus the explicit manage grant', function () {
    $manager = User::factory()->manager()->create();

    $claims = $manager->getJWTCustomClaims();

    expect($claims['abilities'])->toContain(
        'report:create', 'report:update', 'report:replace', 'report:delete',
        'user:create', 'user:update', 'user:replace', 'user:delete', 'user:manage',
    );
});

test('creating a BFP account requires the explicit manage grant in the token', function () {
    $manager = User::factory()->manager()->create();
    $token = loginToken($manager);

    // BFP managers hold user:manage, so they may create BFP personnel accounts.
    $this->withToken($token)->postJson('/api/v1/users', createUserPayload(userAttributes([
        'email' => 'new.bfp@example.com',
        'role' => User::ROLE_BFP,
    ])))
        ->assertCreated()
        ->assertJsonPath('data.attributes.role', User::ROLE_BFP);

    $this->assertDatabaseHas('users', ['email' => 'new.bfp@example.com', 'role' => User::ROLE_BFP]);
});

test('a token without user:manage cannot create an elevated account', function () {
    // Simulate a future restricted account-management token: user:create only.
    $creator = User::factory()->create();
    $token = Auth::guard('api')->claims(['abilities' => ['user:create']])->login($creator);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $this->withToken($token)->postJson('/api/v1/users', createUserPayload(userAttributes([
        'email' => 'elevated.attempt@example.com',
        'role' => User::ROLE_BFP,
        'isManager' => true,
    ])))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['data.attributes.role', 'data.attributes.isManager']);

    $this->assertDatabaseMissing('users', ['email' => 'elevated.attempt@example.com']);
});

test('a token without user:manage cannot promote an existing user via PATCH', function () {
    $limited = User::factory()->create();
    $token = Auth::guard('api')->claims(['abilities' => ['user:update']])->login($limited);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $resident = User::factory()->create();

    $this->withToken($token)->patchJson("/api/v1/users/{$resident->id}", createUserPayload([
        'role' => User::ROLE_BFP,
        'isManager' => true,
    ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['data.attributes.role', 'data.attributes.isManager']);

    $this->assertDatabaseHas('users', ['id' => $resident->id, 'role' => User::ROLE_RESIDENT]);
});

test('a token without user:manage can still rename a plain resident account', function () {
    $limited = User::factory()->create();
    $token = Auth::guard('api')->claims(['abilities' => ['user:update', 'user:replace', 'user:delete', 'user:create']])->login($limited);
    Auth::forgetGuards();
    JWTAuth::unsetToken();

    $resident = User::factory()->create(['name' => 'Before Rename']);

    $this->withToken($token)->patchJson("/api/v1/users/{$resident->id}", createUserPayload([
        'name' => 'After Rename',
    ]))
        ->assertOk()
        ->assertJsonPath('data.attributes.name', 'After Rename');
});

test('manager can promote a resident to BFP with PATCH through the manage grant', function () {
    $manager = User::factory()->manager()->create();
    $resident = User::factory()->create();
    $token = loginToken($manager);

    $this->withToken($token)->patchJson("/api/v1/users/{$resident->id}", createUserPayload([
        'role' => User::ROLE_BFP,
    ]))
        ->assertOk()
        ->assertJsonPath('data.attributes.role', User::ROLE_BFP);

    $this->assertDatabaseHas('users', ['id' => $resident->id, 'role' => User::ROLE_BFP]);
});
