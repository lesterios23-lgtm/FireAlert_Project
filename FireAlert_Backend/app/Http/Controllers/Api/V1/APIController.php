<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponses;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

/**
 * Base class for the version 1 API controllers. Shared helpers live here.
 */
class APIController extends Controller
{
    // Gives every controller that extends this class the response helpers and authorization
    use ApiResponses, AuthorizesRequests;

    /**
     * Returns true when the client asked for a relationship with ?include=...
     * Example: /reports?include=resident -> include('resident') is true.
     */
    public function include(string $relationship): bool
    {
        $requestedIncludes = request()->query('include');

        if (! is_string($requestedIncludes)) {
            return false;
        }

        $includes = array_map('trim', explode(',', strtolower($requestedIncludes)));

        return in_array(strtolower($relationship), $includes, true);
    }

    /**
     * Asks the policy whether the logged-in user may do $ability on $target.
     * Returns true or false instead of throwing an exception.
     *
     * Example: isAble('update', $report) calls FireReportPolicy::update()
     */
    public function isAble(string $ability, mixed $target): bool
    {
        try {
            $this->authorize($ability, $target);

            return true;
        } catch (AuthorizationException $e) {
            return false;
        }
    }
}
