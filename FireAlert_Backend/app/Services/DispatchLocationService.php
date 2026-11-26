<?php

namespace App\Services;

use App\Models\FireIncident;
use App\Models\FireReport;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Reads and writes the live responder position attached to a dispatch.
 *
 * A dispatch is stored against one report, but BFP coordinates a whole Main
 * Incident. Every lookup therefore expands to every report in the same
 * incident group, so a resident viewing any supporting report still sees the
 * shared response unit and its current location.
 */
class DispatchLocationService
{
    public const ARRIVAL_RADIUS_METERS = 75.0;

    public const STATIONARY_RADIUS_METERS = 15.0;

    public const STATIONARY_DWELL_SECONDS = 10;
    public function latestForReport(FireReport $report): ?array
    {
        $row = $this->latestRowForReports($this->reportIdsFor($report));

        return $row ? $this->serialize($row) : null;
    }

    /**
     * @param  list<int|string>  $reportIds
     */
    public function latestForReports(array $reportIds): ?array
    {
        $row = $this->latestRowForReports($reportIds);

        return $row ? $this->serialize($row) : null;
    }

    /**
     * @param  list<int|string>  $reportIds
     */
    public function latestRowForReports(array $reportIds): ?object
    {
        if (! Schema::hasTable('response_dispatches') || $reportIds === []) {
            return null;
        }

        $query = DB::table('response_dispatches as dispatches');
        $columns = [
            'dispatches.dispatch_id as id',
            'dispatches.report_id',
            'dispatches.personnel_id',
            'dispatches.truck_id',
            'dispatches.dispatched_at',
            'dispatches.arrived_at',
            'dispatches.estimated_eta_minutes',
        ];

        if (Schema::hasColumn('response_dispatches', 'current_latitude')) {
            $columns[] = 'dispatches.current_latitude';
        }
        if (Schema::hasColumn('response_dispatches', 'current_longitude')) {
            $columns[] = 'dispatches.current_longitude';
        }
        if (Schema::hasColumn('response_dispatches', 'location_accuracy_meters')) {
            $columns[] = 'dispatches.location_accuracy_meters';
        }
        if (Schema::hasColumn('response_dispatches', 'location_updated_at')) {
            $columns[] = 'dispatches.location_updated_at';
        }

        if (Schema::hasTable('firetrucks')) {
            $query->leftJoin('firetrucks as trucks', 'trucks.truck_id', '=', 'dispatches.truck_id');
            $columns[] = 'trucks.unit_name';
            $columns[] = 'trucks.plate_number';
        }

        if (Schema::hasTable('bfp_personnel') && Schema::hasTable('users')) {
            $query->leftJoin('bfp_personnel as personnel', 'personnel.personnel_id', '=', 'dispatches.personnel_id');

            $userKey = Schema::hasColumn('users', 'user_id') ? 'user_id' : 'id';
            $nameColumn = Schema::hasColumn('users', 'full_name') ? 'full_name' : 'name';
            $query->leftJoin('users as personnel_users', 'personnel_users.'.$userKey, '=', 'personnel.user_id');
            $columns[] = 'personnel_users.'.$nameColumn.' as personnel_name';
        }

        return $query
            ->whereIn('dispatches.report_id', $reportIds)
            ->orderByDesc('dispatches.dispatched_at')
            ->orderByDesc('dispatches.dispatch_id')
            ->first($columns);
    }

    public function updateForReport(
        FireReport $report,
        float $latitude,
        float $longitude,
        ?float $accuracyMeters = null,
        bool $forceArrived = false,
    ): ?array {
        if (! Schema::hasTable('response_dispatches')
            || ! Schema::hasColumn('response_dispatches', 'current_latitude')
            || ! Schema::hasColumn('response_dispatches', 'current_longitude')) {
            return null;
        }

        $dispatch = $this->latestRowForReports($this->reportIdsFor($report));
        if (! $dispatch) {
            return null;
        }

        $isResponding = $report->status === 'responding'
            || ($report->fire_incident_id !== null
                && FireIncident::query()->whereKey($report->fire_incident_id)->value('status') === 'responding');

        $shouldAutoArrive = false;
        if ($isResponding && $report->latitude !== null && $report->longitude !== null) {
            $incidentLat = (float) $report->latitude;
            $incidentLng = (float) $report->longitude;
            $distanceToIncident = $this->haversineMeters($latitude, $longitude, $incidentLat, $incidentLng);

            if ($distanceToIncident <= self::ARRIVAL_RADIUS_METERS) {
                if ($forceArrived) {
                    $shouldAutoArrive = true;
                } elseif (
                    $dispatch->current_latitude !== null
                    && $dispatch->current_longitude !== null
                    && $dispatch->location_updated_at !== null
                ) {
                    $prevLat = (float) $dispatch->current_latitude;
                    $prevLng = (float) $dispatch->current_longitude;
                    $prevDistToIncident = $this->haversineMeters($prevLat, $prevLng, $incidentLat, $incidentLng);
                    $movementMeters = $this->haversineMeters($latitude, $longitude, $prevLat, $prevLng);
                    $elapsedSeconds = abs(now()->getTimestamp() - Carbon::parse($dispatch->location_updated_at)->getTimestamp());

                    if (
                        $prevDistToIncident <= self::ARRIVAL_RADIUS_METERS
                        && $movementMeters < self::STATIONARY_RADIUS_METERS
                        && $elapsedSeconds >= self::STATIONARY_DWELL_SECONDS
                    ) {
                        $shouldAutoArrive = true;
                    }
                }
            }
        }

        $attributes = [
            'current_latitude' => $latitude,
            'current_longitude' => $longitude,
        ];

        if (Schema::hasColumn('response_dispatches', 'location_accuracy_meters')) {
            $attributes['location_accuracy_meters'] = $accuracyMeters;
        }
        if (Schema::hasColumn('response_dispatches', 'location_updated_at')) {
            $attributes['location_updated_at'] = now();
        }

        DB::table('response_dispatches')
            ->where('dispatch_id', $dispatch->id)
            ->update($attributes);

        if ($shouldAutoArrive) {
            $this->markArrived($report, (int) $dispatch->id);
        }

        $serialized = $this->latestForReport($report);
        if ($serialized !== null) {
            $serialized['auto_arrived'] = $shouldAutoArrive;
        }

        return $serialized;
    }

    public function markArrived(FireReport $report, ?int $dispatchId = null): void
    {
        DB::transaction(function () use ($report, $dispatchId): void {
            if (Schema::hasTable('response_dispatches')) {
                $query = DB::table('response_dispatches')->whereNull('arrived_at');
                if ($dispatchId !== null) {
                    $query->where('dispatch_id', $dispatchId);
                } else {
                    $query->whereIn('report_id', $this->reportIdsFor($report));
                }
                $query->update(['arrived_at' => now()]);
            }

            if ($report->status === 'responding') {
                $report->updateFromApi(['status' => 'arrived']);
            }

            if ($report->fire_incident_id !== null) {
                $incident = FireIncident::query()
                    ->whereKey($report->fire_incident_id)
                    ->lockForUpdate()
                    ->first();

                if ($incident && $incident->status === 'responding') {
                    $incident->status = 'arrived';
                    $incident->save();
                }

                FireReport::query()
                    ->where('fire_incident_id', $report->fire_incident_id)
                    ->whereNotIn(
                        FireReport::columnFor('status'),
                        FireReport::statusIdsForValues(['resolved', 'rejected']),
                    )
                    ->update([
                        FireReport::columnFor('status') => FireReport::statusIdsForValues(['arrived'])[0] ?? 'arrived',
                    ]);
            }
        });
    }

    private function haversineMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadiusMeters = 6371000.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * (sin($dLng / 2) ** 2);

        return 2 * $earthRadiusMeters * asin(min(1.0, sqrt($a)));
    }

    /**
     * @return list<int|string>
     */
    public function reportIdsFor(FireReport $report): array
    {
        $ids = [$report->getKey()];

        if ($report->fire_incident_id !== null) {
            $ids = FireReport::query()
                ->where('fire_incident_id', $report->fire_incident_id)
                ->pluck($report->getKeyName())
                ->all();
        }

        return $ids === [] ? [0] : $ids;
    }

    private function serialize(object $row): array
    {
        $latitude = $row->current_latitude ?? null;
        $longitude = $row->current_longitude ?? null;
        $accuracy = $row->location_accuracy_meters ?? null;
        $updatedAt = $row->location_updated_at ?? null;

        return [
            'id' => $row->id,
            'report_id' => $row->report_id,
            'personnel_id' => $row->personnel_id,
            'truck_id' => $row->truck_id,
            'dispatched_at' => $row->dispatched_at,
            'arrived_at' => $row->arrived_at,
            'estimated_eta_minutes' => $row->estimated_eta_minutes,
            'unit_name' => $row->unit_name ?? null,
            'plate_number' => $row->plate_number ?? null,
            'personnel_name' => $row->personnel_name ?? null,
            'current_latitude' => $latitude !== null ? (float) $latitude : null,
            'current_longitude' => $longitude !== null ? (float) $longitude : null,
            'location_accuracy_meters' => $accuracy !== null ? (float) $accuracy : null,
            'location_updated_at' => $updatedAt,
            'current_location' => $latitude !== null && $longitude !== null
                ? [
                    'latitude' => (float) $latitude,
                    'longitude' => (float) $longitude,
                    'accuracyMeters' => $accuracy !== null ? (float) $accuracy : null,
                    'updatedAt' => $updatedAt,
                ]
                : null,
        ];
    }
}
