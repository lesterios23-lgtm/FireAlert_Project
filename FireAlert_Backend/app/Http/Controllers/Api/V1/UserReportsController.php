<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Filters\V1\FireReportFilter;
use App\Http\Requests\Api\V1\ReplaceFireReportRequest;
use App\Http\Requests\Api\V1\StoreFireReportRequest;
use App\Http\Requests\Api\V1\UpdateFireReportRequest;
use App\Http\Resources\V1\FireReportResource;
use App\Models\FireReport;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class UserReportsController extends APIController
{
    /**
     * @group User Reports
     *
     * Fire reports that belong to a specific user: /api/v1/users/{user}/reports.
     */

    public function index(
        Request $request,
        User $user,
        FireReportFilter $filters,
    ): AnonymousResourceCollection {
        abort_unless(
            (string) $user->getKey() === (string) $request->user()->getAuthIdentifier(),
            404,
        );

        $reports = FireReport::query()
            ->where('resident_id', $user->getKey())
            ->filter($filters)
            ->paginate(15);

        return FireReportResource::collection($reports);
    }

    /**
     * POST /api/v1/users/{user}/reports
     * Creates a report owned by the user in the URL, but only if the
     * policy allows this user to create reports.
     */
    public function store(StoreFireReportRequest $request, User $user): FireReportResource|JsonResponse
    {
        if ($this->isAble('store', FireReport::class)) {
            $report = FireReport::create([
                ...$request->mappedAttributes(),
                // The resident is the user from the URL, not the request body
                'resident_id' => $user->getKey(),
                'status'      => 'pending',
                'reported_at' => now(),
            ]);

            return new FireReportResource($report);
        }

        return $this->notAuthorized('You are not authorized to create that resource.');
    }

    /**
     * DELETE /api/v1/users/{user}/reports/{report}
     * Deletes the report, but only if the policy allows it.
     */
    public function destroy(User $user, FireReport $report): JsonResponse
    {
        if ($this->isAble('delete', $report)) {
            $report->delete();

            return $this->ok('Report successfully deleted');
        }

        return $this->notAuthorized('You are not authorized to delete that resource.');
    }

    /**
     * PUT /api/v1/users/{user}/reports/{report}
     * Replaces the whole report, but only if the policy allows it.
     */
    public function replace(ReplaceFireReportRequest $request, User $user, FireReport $report): FireReportResource|JsonResponse
    {
        if ($this->isAble('replace', $report)) {
            $report->update($request->mappedAttributes());

            return new FireReportResource($report);
        }

        return $this->notAuthorized('You are not authorized to replace that resource.');
    }

    /**
     * PATCH /api/v1/users/{user}/reports/{report}
     * Updates only the fields that were sent, but only if the policy allows it.
     */
    public function update(UpdateFireReportRequest $request, User $user, FireReport $report): FireReportResource|JsonResponse
    {
        if ($this->isAble('update', $report)) {
            $report->update($request->mappedAttributes());

            return new FireReportResource($report);
        }

        return $this->notAuthorized('You are not authorized to update that resource.');
    }
}
