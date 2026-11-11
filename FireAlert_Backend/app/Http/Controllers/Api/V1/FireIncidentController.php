<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Resources\V1\FireIncidentResource;
use App\Http\Resources\V1\FireReportResource;
use App\Models\FireIncident;
use App\Models\FireReport;
use App\Services\IncidentGroupingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * BFP-only incident grouping: the Main Incident list, report attachments,
 * separations, merges, and the audit trail.
 */
class FireIncidentController extends APIController
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeBfp($request);

        $incidents = FireIncident::query()
            ->with(['reports' => function ($query) {
                $query->with('resident')->orderBy(FireReport::columnFor('reportedAt'));
            }])
            ->withCount('reports')
            ->orderByDesc('last_reported_at')
            ->get();

        return $this->ok('Incident groups retrieved', [
            'incidents' => $incidents->map(function (FireIncident $incident) use ($request): array {
                $data = (new FireIncidentResource($incident))->resolve($request);
                $reports = $incident->reports->map(
                    fn (FireReport $report) => (new FireReportResource($report->loadMissing('resident')))->resolve($request)
                )->values()->all();
                $data['attributes']['reports'] = $reports;
                $data['attributes']['possibleDuplicates'] = $incident->reports
                    ->where('duplicate_flag', 'possible')
                    ->map(fn (FireReport $report) => $report->getKey())
                    ->values()
                    ->all();
                $reportIds = $incident->reports->map(fn ($r) => $r->getKey())->all() ?: [0];
                $data['dispatch'] = null;
                if (Schema::hasTable('response_dispatches')) {
                    $data['dispatch'] = DB::table('response_dispatches as dispatches')
                        ->leftJoin('firetrucks as trucks', 'trucks.truck_id', '=', 'dispatches.truck_id')
                        ->leftJoin('bfp_personnel as personnel', 'personnel.personnel_id', '=', 'dispatches.personnel_id')
                        ->leftJoin('users as personnel_users', 'personnel_users.user_id', '=', 'personnel.user_id')
                        ->whereIn('dispatches.report_id', $reportIds)
                        ->orderByDesc('dispatches.dispatched_at')
                        ->first([
                            'dispatches.dispatch_id as id',
                            'dispatches.report_id',
                            'dispatches.personnel_id',
                            'dispatches.truck_id',
                            'dispatches.dispatched_at',
                            'dispatches.arrived_at',
                            'dispatches.estimated_eta_minutes',
                            'trucks.unit_name',
                            'trucks.plate_number',
                            'personnel_users.full_name as personnel_name',
                        ]);
                }

                return $data;
            })->values()->all(),
        ]);
    }

    public function show(Request $request, FireIncident $incident): JsonResponse
    {
        $this->authorizeBfp($request);

        $incident->load(['reports.resident', 'reports.evidence', 'actions.actor']);
        $data = (new FireIncidentResource($incident))->resolve($request);
        $data['attributes']['reports'] = $incident->reports
            ->map(fn (FireReport $report) => (new FireReportResource($report))->resolve($request))
            ->values()
            ->all();
        $data['attributes']['actionLog'] = $incident->actions
            ->sortByDesc('created_at')
            ->map(fn ($action) => [
                'id' => $action->id,
                'action' => $action->action,
                'reportId' => $action->fire_report_id,
                'actorName' => $action->actor?->name,
                'reason' => $action->reason,
                'meta' => $action->meta,
                'createdAt' => $action->created_at,
            ])
            ->values()
            ->all();

        return $this->ok('Incident group retrieved', ['incident' => $data]);
    }

    public function attach(Request $request, FireIncident $incident, FireReport $report): JsonResponse
    {
        $this->authorizeBfp($request);

        $attributes = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $grouped = IncidentGroupingService::fromConfig()->attachToIncident(
            $report,
            $incident,
            $request->user()?->getAuthIdentifier(),
            $attributes['reason'] ?? null,
        );

        return $this->ok('Report attached to the incident', [
            'incident' => (new FireIncidentResource($grouped->load('reports')))->resolve($request),
        ]);
    }

    public function detach(Request $request, FireReport $report): JsonResponse
    {
        $this->authorizeBfp($request);

        $attributes = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $split = IncidentGroupingService::fromConfig()->detachReport(
            $report,
            $request->user()?->getAuthIdentifier(),
            $attributes['reason'] ?? null,
        );

        return $this->ok('Report separated into its own incident', [
            'incident' => (new FireIncidentResource($split->load('reports')))->resolve($request),
        ]);
    }

    public function merge(Request $request, FireIncident $incident): JsonResponse
    {
        $this->authorizeBfp($request);

        $attributes = $request->validate([
            'into_incident_id' => ['required', 'integer', 'exists:fire_incidents,id', 'different:incident'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);
        // Route-model binding already resolved $incident as the source.

        $target = FireIncident::query()->findOrFail($attributes['into_incident_id']);
        $merged = IncidentGroupingService::fromConfig()->mergeIncidents(
            $incident,
            $target,
            $request->user()?->getAuthIdentifier(),
            $attributes['reason'] ?? null,
        );

        return $this->ok('Incidents merged', [
            'incident' => (new FireIncidentResource($merged->load('reports')))->resolve($request),
        ]);
    }

    public function updateStatus(Request $request, FireIncident $incident): JsonResponse
    {
        $this->authorizeBfp($request);

        $attributes = $request->validate([
            'status' => ['required', 'string', 'in:pending,accepted,responding,resolved,rejected'],
        ]);

        DB::transaction(function () use ($incident, $attributes, $request): void {
            $incident = FireIncident::query()->whereKey($incident->getKey())->lockForUpdate()->firstOrFail();
            $incident->status = $attributes['status'];
            $incident->save();

            // Keep grouped reports in step with the main incident so the
            // resident + command-center views stay consistent.
            FireReport::query()
                ->where('fire_incident_id', $incident->getKey())
                ->whereNotIn(FireReport::columnFor('status'), FireReport::statusIdsForValues(['resolved', 'rejected']))
                ->update([FireReport::columnFor('status') => FireReport::statusIdsForValues([$attributes['status']])[0] ?? $attributes['status']]);

            \App\Models\FireIncidentAction::create([
                'fire_incident_id' => $incident->getKey(),
                'fire_report_id' => null,
                'actor_id' => $request->user()?->getAuthIdentifier(),
                'action' => \App\Models\FireIncidentAction::STATUS_CHANGED,
                'reason' => null,
                'meta' => ['status' => $attributes['status']],
            ]);
        });

        return $this->ok('Incident status updated');
    }

    private function authorizeBfp(Request $request): void
    {
        $user = $request->user();
        abort_unless(
            $user->is_manager || in_array($user->role, [\App\Models\User::ROLE_BFP, 'admin'], true),
            403,
        );
    }
}
