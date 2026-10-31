<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Filters\V1\FireReportFilter;
use App\Http\Requests\Api\V1\StoreFireReportRequest;
use App\Http\Resources\V1\FireReportResource;
use App\Models\FireReport;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class FireReportController extends APIController
{
    public function store(StoreFireReportRequest $request): FireReportResource
    {
        $report = FireReport::create([
            ...$request->mappedAttributes(),
            'resident_id' => $request->user()->getAuthIdentifier(),
            'status' => 'pending',
            'reported_at' => now(),
        ]);

        return new FireReportResource($report);
    }

    public function index(Request $request, FireReportFilter $filters): AnonymousResourceCollection
    {
        $query = FireReport::query()
            ->where('resident_id', $request->user()->getAuthIdentifier())
            ->filter($filters);

        $reports = $query->paginate(15);

        return FireReportResource::collection($reports);
    }

    public function show(Request $request, FireReport $report): FireReportResource
    {
        $query = FireReport::query()
            ->where('resident_id', $request->user()->getAuthIdentifier());

        if ($this->include('resident')) {
            $query->with('resident:id,name');
        }

        $ownedReport = $query->findOrFail($report->getKey());

        return new FireReportResource($ownedReport);
    }
}
