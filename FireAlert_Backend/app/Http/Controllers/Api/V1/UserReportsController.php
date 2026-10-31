<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Filters\V1\FireReportFilter;
use App\Http\Resources\V1\FireReportResource;
use App\Models\FireReport;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class UserReportsController extends APIController
{
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
}
