<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Resources\V1\FireReportResource;
use App\Models\FireReport;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BfpCommandCenterController extends APIController
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeBfp($request);

        $reports = FireReport::query()
            ->with('resident')
            ->withCount('evidence')
            ->orderByDesc(FireReport::columnFor('reportedAt'))
            ->get()
            ->map(function (FireReport $report) use ($request): array {
                $data = (new FireReportResource($report))->resolve($request);
                $data['dispatch'] = DB::table('response_dispatches as dispatches')
                    ->leftJoin('firetrucks as trucks', 'trucks.truck_id', '=', 'dispatches.truck_id')
                    ->leftJoin('bfp_personnel as personnel', 'personnel.personnel_id', '=', 'dispatches.personnel_id')
                    ->leftJoin('users as personnel_users', 'personnel_users.user_id', '=', 'personnel.user_id')
                    ->where('dispatches.report_id', $report->getKey())
                    ->orderByDesc('dispatches.dispatched_at')
                    ->first([
                        'dispatches.dispatch_id as id',
                        'dispatches.personnel_id',
                        'dispatches.truck_id',
                        'dispatches.dispatched_at',
                        'dispatches.arrived_at',
                        'dispatches.estimated_eta_minutes',
                        'trucks.unit_name',
                        'trucks.plate_number',
                        'personnel_users.full_name as personnel_name',
                    ]);
                $data['incidentRecord'] = DB::table('incident_records')
                    ->where('report_id', $report->getKey())
                    ->first([
                        'record_id',
                        'personnel_id',
                        'damage_assessment',
                        'casualties_count',
                        'resolution_summary',
                        'archived_at',
                    ]);

                return $data;
            });

        return $this->ok('Command center data retrieved', [
            'reports' => $reports,
            'trucks' => DB::table('firetrucks as trucks')
                ->orderBy('trucks.unit_name')
                ->get([
                    'trucks.truck_id',
                    'trucks.unit_name',
                    'trucks.plate_number',
                    'trucks.status',
                ]),
            'personnel' => DB::table('users')
                ->join('roles', 'roles.role_id', '=', 'users.role_id')
                ->leftJoin('bfp_personnel as personnel', 'personnel.user_id', '=', 'users.user_id')
                ->whereRaw('LOWER(roles.role_name) = ?', ['bfp staff'])
                ->orderBy('users.full_name')
                ->get([
                    'personnel.personnel_id',
                    'personnel.badge_number',
                    'personnel.rank_position',
                    'users.user_id',
                    'users.full_name',
                ]),
            'statuses' => DB::table('response_statuses')
                ->orderBy('status_id')
                ->get(['status_id', 'status_name', 'description']),
        ]);
    }

    public function dispatch(Request $request, FireReport $report): JsonResponse
    {
        $this->authorizeBfp($request);

        $attributes = $request->validate([
            'truck_id' => ['required', 'integer', 'exists:firetrucks,truck_id'],
            'personnel_id' => ['required', 'integer', 'exists:bfp_personnel,personnel_id'],
            'estimated_eta_minutes' => ['required', 'integer', 'between:1,1440'],
        ]);

        DB::transaction(function () use ($attributes, $report): void {
            $dispatch = DB::table('response_dispatches')
                ->where('report_id', $report->getKey())
                ->orderByDesc('dispatched_at')
                ->first(['dispatch_id']);
            $dispatchAttributes = [
                'truck_id' => $attributes['truck_id'],
                'personnel_id' => $attributes['personnel_id'],
                'dispatched_at' => now(),
                'estimated_eta_minutes' => $attributes['estimated_eta_minutes'],
            ];

            if ($dispatch) {
                DB::table('response_dispatches')
                    ->where('dispatch_id', $dispatch->dispatch_id)
                    ->update($dispatchAttributes);
            } else {
                DB::table('response_dispatches')->insert([
                    ...$dispatchAttributes,
                    'report_id' => $report->getKey(),
                ]);
            }

            $report->updateFromApi(['status' => 'responding']);
        });

        return $this->ok('Response unit dispatched', [
            'report_id' => $report->getKey(),
        ]);
    }

    public function saveIncidentRecord(Request $request, FireReport $report): JsonResponse
    {
        $this->authorizeBfp($request);

        $attributes = $request->validate([
            'damage_assessment' => ['nullable', 'string', 'max:5000'],
            'casualties_count' => ['required', 'integer', 'min:0'],
            'resolution_summary' => ['nullable', 'string', 'max:5000'],
        ]);
        $personnelId = DB::table('bfp_personnel')
            ->where('user_id', $request->user()->getAuthIdentifier())
            ->value('personnel_id');
        if ($personnelId === null) {
            return $this->error('Your account is not linked to a BFP personnel record.', 422);
        }

        $record = DB::table('incident_records')
            ->where('report_id', $report->getKey())
            ->first(['record_id']);
        $recordAttributes = [
            'personnel_id' => $personnelId,
            'damage_assessment' => $attributes['damage_assessment'] ?? null,
            'casualties_count' => $attributes['casualties_count'],
            'resolution_summary' => $attributes['resolution_summary'] ?? null,
        ];

        if ($record) {
            DB::table('incident_records')
                ->where('record_id', $record->record_id)
                ->update($recordAttributes);
        } else {
            DB::table('incident_records')->insert([
                ...$recordAttributes,
                'report_id' => $report->getKey(),
            ]);
        }

        return $this->ok('Incident record saved');
    }

    private function authorizeBfp(Request $request): void
    {
        $user = $request->user();
        abort_unless(
            $user->is_manager || in_array($user->role, [User::ROLE_BFP, 'admin'], true),
            403,
        );
    }
}
