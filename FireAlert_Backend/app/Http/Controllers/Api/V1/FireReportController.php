<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Filters\V1\FireReportFilter;
use App\Http\Requests\Api\V1\ReplaceFireReportRequest;
use App\Http\Requests\Api\V1\StoreFireReportRequest;
use App\Http\Requests\Api\V1\UpdateFireReportRequest;
use App\Http\Resources\V1\FireReportResource;
use App\Models\FireReport;
use App\Models\User;
use App\Models\ReportEvidence;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class FireReportController extends APIController
{
    /**
     * @group Fire Reports
     *
     * Create, read, update and delete fire incident reports.
     */

    /**
     * POST /api/v1/reports
     * Creates a report, but only if the policy allows this user to do so.
     * If the validated body includes a resident id (managers may set this),
     * it is used; otherwise the authenticated user is the owner.
     */
    public function store(StoreFireReportRequest $request): FireReportResource|JsonResponse
    {
        if ($this->isAble('store', FireReport::class)) {
            $mapped = $request->mappedAttributes();
            $storedPath = null;

            try {
                $report = DB::transaction(function () use ($mapped, $request, &$storedPath): FireReport {
                    $report = FireReport::createFromApi([
                        ...$mapped,
                        'resident_id' => $mapped['resident_id'] ?? $request->user()->getAuthIdentifier(),
                        'status' => 'pending',
                        'reported_at' => now(),
                    ]);

                    if ($request->hasFile('evidencePhoto')) {
                        $photo = $request->file('evidencePhoto');
                        $storedPath = Storage::disk('local')->putFile('report-evidence', $photo);
                        if ($storedPath === false) {
                            throw new \RuntimeException('Unable to store report evidence.');
                        }

                        ReportEvidence::create([
                            'report_id' => $report->getKey(),
                            'storage_path' => $storedPath,
                            'original_name' => $photo->getClientOriginalName(),
                            'mime_type' => $photo->getMimeType() ?: 'application/octet-stream',
                            'file_size' => $photo->getSize(),
                            'uploaded_at' => now(),
                        ]);
                    }

                    return $report;
                });
            } catch (\Throwable $exception) {
                if ($storedPath !== null) {
                    Storage::disk('local')->delete($storedPath);
                }

                throw $exception;
            }

            return new FireReportResource($report);
        }

        return $this->notAuthorized('You are not authorized to create that resource.');
    }

    public function evidence(Request $request, FireReport $report): BinaryFileResponse
    {
        $user = $request->user();
        $hasBfpAccess = $user->is_manager
            || in_array($user->role, [User::ROLE_BFP, 'admin'], true);

        abort_unless(
            $hasBfpAccess || (string) $report->resident_id === (string) $user->getAuthIdentifier(),
            404,
        );

        $evidence = $report->evidence()->orderByDesc('uploaded_at')->firstOrFail();
        abort_unless(Storage::disk('local')->exists($evidence->storage_path), 404);

        return response()->file(
            Storage::disk('local')->path($evidence->storage_path),
            [
                'Content-Type' => $evidence->mime_type,
                'Cache-Control' => 'private, no-store',
                'X-Content-Type-Options' => 'nosniff',
            ],
        );
    }

    public function index(Request $request, FireReportFilter $filters): AnonymousResourceCollection
    {
        /**
         * List fire reports
         *
         * Returns a paginated list of fire reports owned by the authenticated user.
         * Supports filtering, sorting and including the resident.
         *
         * @queryParam status string Filter by status. Use a comma for several. Example: pending,resolved
         * @queryParam incidentAddress string Filter by address. Use * as a wildcard. Example: *Rizal*
         * @queryParam reportedAt string A date, or a range as from,to. Example: 2026-01-01,2026-12-31
         * @queryParam sort string Sort by status, incidentAddress, reportedAt or createdAt. Prefix with - for descending. Example: -reportedAt
         * @queryParam include string Include related data. Example: resident
         * @queryParam page integer The page number. Example: 1
         */
        $query = FireReport::query();

        // Managers / BFP personnel see all incoming reports (spec E.2);
        // residents only ever see their own.
        $isManager = $request->user()->is_manager
            || $request->user()->role === User::ROLE_BFP;

        if (! $isManager) {
            $query->where(FireReport::residentForeignKey(), $request->user()->getAuthIdentifier());
        }

        $reports = $query->filter($filters)
            ->with($isManager ? ['resident'] : [])
            ->paginate(15);

        return FireReportResource::collection($reports);
    }

    public function show(Request $request, FireReport $report): FireReportResource
    {
        $query = FireReport::query()
            ->where(FireReport::residentForeignKey(), $request->user()->getAuthIdentifier());

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
            $report->updateFromApi($request->mappedAttributes());

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
            $report->updateFromApi($request->mappedAttributes());

            return new FireReportResource($report);
        }

        return $this->notAuthorized('You are not authorized to update that resource.');
    }
}
