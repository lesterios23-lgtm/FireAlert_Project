<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;

class APIController extends Controller
{
    public function include(string $relationship): bool
    {
        $requestedIncludes = request()->query('include');

        if (! is_string($requestedIncludes)) {
            return false;
        }

        $includes = array_map('trim', explode(',', strtolower($requestedIncludes)));

        return in_array(strtolower($relationship), $includes, true);
    }
}
