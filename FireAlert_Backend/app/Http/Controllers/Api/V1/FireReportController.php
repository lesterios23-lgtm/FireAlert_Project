<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Filters\V1\FireReportFilter;
use App\Http\Requests\Api\V1\ReplaceFireReportRequest;
use App\Http\Requests\Api\V1\StoreFireReportRequest;
use App\Http\Requests\Api\V1\UpdateFireReportRequest;
use App\Http\Resources\V1\FireReportResource;
use App\Models\FireReport;
use Illuminate\Http\JsonResponse;
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

    /**
     * DELETE /api/v1/reports/{report}
     * Deletes the fire report. A missing report never reaches this method: Laravel answers 404.
     */
    public function destroy(Request $request, FireReport $report): JsonResponse
    {
        $ownedReport = FireReport::query()
            ->where('resident_id', $request->user()->getAuthIdentifier())
            ->findOrFail($report->getKey());

        $ownedReport->delete();

        return $this->ok('Report successfully deleted');
    }

    /**
     * PUT /api/v1/reports/{report}
     * Replaces the fire report: all required incident attributes must be sent.
     */
    public function replace(ReplaceFireReportRequest $request, FireReport $report): FireReportResource
    {
        $ownedReport = FireReport::query()
            ->where('resident_id', $request->user()->getAuthIdentifier())
            ->findOrFail($report->getKey());

        $ownedReport->update($request->mappedAttributes());

        return new FireReportResource($ownedReport);
    }

    /**
     * PATCH /api/v1/reports/{report}
     * Updates only the fields that were sent (see UpdateFireReportRequest).
     */
    public function update(UpdateFireReportRequest $request, FireReport $report): FireReportResource
    {
        $ownedReport = FireReport::query()
            ->where('resident_id', $request->user()->getAuthIdentifier())
            ->findOrFail($report->getKey());

        $ownedReport->update($request->mappedAttributes());

        return new FireReportResource($ownedReport);
    }
}
