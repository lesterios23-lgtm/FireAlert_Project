<?php

use Illuminate\Support\Facades\Auth;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;

/**
 * Logs a user in with the api guard and returns a fresh bearer token.
 * Shared by the controller test files.
 */
if (! function_exists('loginToken')) {
    function loginToken(App\Models\User $user): string
    {
        $token = Auth::guard('api')->login($user);
        Auth::forgetGuards();
        JWTAuth::unsetToken();

        return $token;
    }
}
