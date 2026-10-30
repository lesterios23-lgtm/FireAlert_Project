<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\FireReport;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Collection;

class FireReportController extends Controller
{
    /**
     * List reports belonging to the authenticated resident.
     *
     * @return Collection<int, FireReport>
     */
    public function index(Request $request): Collection
    {
        return FireReport::query()
            ->where('resident_id', $request->user()->getAuthIdentifier())
            ->get();
    }
}
