<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\V1\FireReportResource;
use App\Models\FireReport;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class FireReportController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $reports = FireReport::query()
            ->where('resident_id', $request->user()->getAuthIdentifier())
            ->paginate(15);

        return FireReportResource::collection($reports);
    }

    public function show(Request $request, FireReport $report): FireReportResource
    {
        $ownedReport = FireReport::query()
            ->where('resident_id', $request->user()->getAuthIdentifier())
            ->findOrFail($report->getKey());

        return new FireReportResource($ownedReport);
    }
}
