<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\LoginUserRequest;
use App\Http\Requests\Api\RegisterUserRequest;
use App\Models\User;
use App\Traits\ApiResponses;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    use ApiResponses;

    /**
     * @group Auth
     *
     * User authentication: register, login, logout, me, refresh.
     */

    /**
     * Register a new user account.
     *
     * @unauthenticated
     */
    public function register(RegisterUserRequest $request): JsonResponse
    {
        $attributes = $request->validated();

        $user = User::create([
            'name' => $attributes['name'],
            'contact_number' => $attributes['contact_number'],
            'email' => $attributes['email'],
            'password' => Hash::make($attributes['password']),
            'role' => User::ROLE_RESIDENT,
        ]);

        $token = Auth::guard('api')->login($user);

        return $this->ok('Registered successfully', $this->formatToken($token));
    }

    /**
     * Authenticate a user and return an access token.
     *
     * @unauthenticated
     */
    public function login(LoginUserRequest $request): JsonResponse
    {
        $settings = Schema::hasTable('system_settings')
            ? app(\App\Services\LoginAttemptSettings::class)->get()
            : [
                'max_attempts' => \App\Services\LoginAttemptSettings::DEFAULT_MAX_ATTEMPTS,
                'lockout_minutes' => \App\Services\LoginAttemptSettings::DEFAULT_LOCKOUT_MINUTES,
            ];
        $email = Str::transliterate(Str::lower((string) $request->input('email')));
        $key = 'login|'.$email;
        $lockoutSeconds = $settings['lockout_minutes'] * 60;

        if (RateLimiter::tooManyAttempts($key, $settings['max_attempts'])) {
            $retryAfter = RateLimiter::availableIn($key);

            return response()->json([
                'message' => 'Too many login attempts. Try again in '.ceil($retryAfter / 60).' minutes.',
                'status' => 429,
                'retry_after' => $retryAfter,
            ], 429, ['Retry-After' => (string) $retryAfter]);
        }

        $token = Auth::guard('api')->attempt($request->validated());

        if (! $token) {
            RateLimiter::hit($key, $lockoutSeconds);
            $remaining = max(0, $settings['max_attempts'] - RateLimiter::attempts($key));

            return response()->json([
                'message' => 'Invalid credentials. '.$remaining.' login '.($remaining === 1 ? 'attempt' : 'attempts').' remaining.',
                'status' => 401,
                'remaining_attempts' => $remaining,
            ], 401);
        }

        RateLimiter::clear($key);

        return $this->ok('Login successful', $this->formatToken($token));
    }

    public function me(): JsonResponse
    {
        return $this->ok('User retrieved', Auth::guard('api')->user());
    }

    public function refresh(): JsonResponse
    {
        $token = Auth::guard('api')->refresh();

        return $this->ok('Token refreshed', $this->formatToken($token));
    }

    public function logout(): JsonResponse
    {
        Auth::guard('api')->logout();

        return $this->ok('Successfully logged out');
    }

    /**
     * Update the authenticated resident's own profile (address, etc.).
     */
    public function updateProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = Auth::guard('api')->user();

        $validated = $request->validate([
            'address' => 'sometimes|nullable|string|max:500',
            'home_latitude' => 'sometimes|nullable|numeric|between:-90,90',
            'home_longitude' => 'sometimes|nullable|numeric|between:-180,180',
        ]);

        // Keep the address text in sync when only coordinates are supplied.
        $addressNeedsSync = ! array_key_exists('address', $validated)
            && (array_key_exists('home_latitude', $validated)
                || array_key_exists('home_longitude', $validated))
            && isset($validated['home_latitude'], $validated['home_longitude'])
            && $validated['home_latitude'] !== null
            && $validated['home_longitude'] !== null
            && ($user->address === null || trim((string) $user->address) === '');

        if ($addressNeedsSync) {
            $latitude = number_format((float) $validated['home_latitude'], 7, '.', '');
            $longitude = number_format((float) $validated['home_longitude'], 7, '.', '');
            $validated['address'] = "Home location: {$latitude}, {$longitude}, Mansalay, Oriental Mindoro";
        }

        $user->update($validated);

        return $this->ok('Profile updated', $user->fresh());
    }

    /**
     * @return array{access_token: string, token_type: string, expires_in: int}
     */
    private function formatToken(string $token): array
    {
        return [
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => (int) config('jwt.ttl') * 60,
        ];
    }
}
