<?php

namespace App\Http\Resources\V1;

use App\Models\FireIncident;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FireIncidentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var FireIncident $incident */
        $incident = $this->resource;
        $reports = $incident->relationLoaded('reports') ? $incident->reports : collect();

        return [
            'type' => 'fire_incident',
            'id' => $incident->id,
            'attributes' => [
                'code' => $incident->code,
                'incidentDescription' => $incident->incident_description,
                'incidentAddress' => $incident->incident_address,
                'latitude' => $incident->latitude,
                'longitude' => $incident->longitude,
                'status' => $incident->status,
                'firstReportedAt' => $incident->first_reported_at,
                'lastReportedAt' => $incident->last_reported_at,
                'reportCount' => $reports instanceof \Illuminate\Support\Collection
                    ? $reports->count()
                    : $incident->reports()->count(),
            ],
            'relationships' => [
                'reports' => [
                    'data' => ($reports instanceof \Illuminate\Support\Collection ? $reports : collect())->map(
                        fn ($report) => ['type' => 'fire_report', 'id' => $report->getKey()]
                    )->values()->all(),
                ],
            ],
            'includes' => $incident->relationLoaded('reports')
                ? ['reports' => FireReportResource::collection($reports)->resolve($request)]
                : new \stdClass(),
        ];
    }
}
