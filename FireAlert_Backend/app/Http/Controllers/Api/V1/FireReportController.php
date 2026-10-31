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
    /**
     * POST /api/v1/reports
     * Creates a report, but only if the policy allows this user to do so.
     */
    public function store(StoreFireReportRequest $request): FireReportResource|JsonResponse
    {
        if ($this->isAble('store', FireReport::class)) {
            $report = FireReport::create([
                ...$request->mappedAttributes(),
                'resident_id' => $request->user()->getAuthIdentifier(),
                'status' => 'pending',
                'reported_at' => now(),
            ]);

            return new FireReportResource($report);
        }

        return $this->notAuthorized('You are not authorized to create that resource.');
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
     * Deletes the report, but only if the policy allows it.
     */
    public function destroy(FireReport $report): JsonResponse
    {
        if ($this->isAble('delete', $report)) {
            $report->delete();

            return $this->ok('Report successfully deleted');
        }

        return $this->notAuthorized('You are not authorized to delete that resource.');
    }

    /**
     * PUT /api/v1/reports/{report}
     * Replaces the whole report, but only if the policy allows it.
     */
    public function replace(ReplaceFireReportRequest $request, FireReport $report): FireReportResource|JsonResponse
    {
        if ($this->isAble('replace', $report)) {
            $report->update($request->mappedAttributes());

            return new FireReportResource($report);
        }

        return $this->notAuthorized('You are not authorized to replace that resource.');
    }

    /**
     * PATCH /api/v1/reports/{report}
     * Updates only the fields that were sent, but only if the policy allows it.
     */
    public function update(UpdateFireReportRequest $request, FireReport $report): FireReportResource|JsonResponse
    {
        if ($this->isAble('update', $report)) {
            $report->update($request->mappedAttributes());

            return new FireReportResource($report);
        }

        return $this->notAuthorized('You are not authorized to update that resource.');
    }
}
