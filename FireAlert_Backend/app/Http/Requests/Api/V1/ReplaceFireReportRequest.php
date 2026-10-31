<?php

namespace App\Http\Requests\Api\V1;

/**
 * Validates the body of PUT /reports/{report}: full replacement of incident details.
 */
class ReplaceFireReportRequest extends BaseFireReportRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * PUT replaces the whole resource, so required attributes must be sent.
     */
    public function rules(): array
    {
        return [
            'data' => ['required', 'array:type,attributes'],
            'data.type' => ['required', 'string', 'in:fire_report'],
            'data.attributes' => [
                'required',
                'array:incidentDescription,incidentAddress,latitude,longitude,locationSource',
            ],
            'data.attributes.incidentDescription' => ['required', 'string'],
            'data.attributes.incidentAddress' => [
                'nullable',
                'required_without_all:data.attributes.latitude,data.attributes.longitude',
                'string',
                'max:255',
            ],
            'data.attributes.latitude' => [
                'required_with:data.attributes.longitude',
                'numeric',
                'between:-90,90',
            ],
            'data.attributes.longitude' => [
                'required_with:data.attributes.latitude',
                'numeric',
                'between:-180,180',
            ],
            'data.attributes.locationSource' => [
                'required_with:data.attributes.latitude',
                'string',
                'in:device,manual',
            ],
        ];
    }

    public function mappedAttributes(): array
    {
        $attributes = $this->validated('data.attributes');

        return [
            'incident_description' => $attributes['incidentDescription'],
            'incident_address' => $attributes['incidentAddress'] ?? null,
            'latitude' => $attributes['latitude'] ?? null,
            'longitude' => $attributes['longitude'] ?? null,
            'location_source' => $attributes['locationSource'] ?? null,
        ];
    }
}

