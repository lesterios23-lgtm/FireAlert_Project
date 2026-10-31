<?php

namespace App\Http\Resources\V1;

use App\Models\FireReport;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FireReportResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var FireReport $report */
        $report = $this->resource;

        return [
            'type' => 'fire_report',
            'id' => $report->id,
            'attributes' => [
                'incidentDescription' => $this->when(
                    ! $request->routeIs('reports.index'),
                    $report->incident_description,
                ),
                'incidentAddress' => $report->incident_address,
                'latitude' => $report->latitude,
                'longitude' => $report->longitude,
                'locationSource' => $report->location_source,
                'status' => $report->status,
                'reportedAt' => $report->reported_at,
                'createdAt' => $report->created_at,
                'updatedAt' => $report->updated_at,
            ],
            'relationships' => [
                'resident' => [
                    'data' => [
                        'type' => 'user',
                        'id' => $report->resident_id,
                    ],
                ],
            ],
            'includes' => $this->whenLoaded('resident', function (User $resident): array {
                return [
                    'resident' => [
                        'type' => 'user',
                        'id' => $resident->id,
                        'attributes' => [
                            'name' => $resident->name,
                        ],
                    ],
                ];
            }),
            'links' => [
                'self' => route('reports.show', ['report' => $report->id]),
            ],
        ];
    }
}
