<?php

namespace App\Http\Requests\Api\V1;

/**
 * Validates the body of PATCH /reports/{report}: only the fields sent are checked.
 */
class UpdateFireReportRequest extends BaseFireReportRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Validation rules for updating a fire report. "sometimes" means:
     * validate the field only when it was sent.
     */
    public function rules(): array
    {
        return [
            'data' => ['sometimes', 'array:type,attributes'],
            'data.type' => ['sometimes', 'string', 'in:fire_report'],
            'data.attributes' => [
                'sometimes',
                'array:incidentDescription,incidentAddress,latitude,longitude,locationSource',
            ],
            'data.attributes.incidentDescription' => ['sometimes', 'string'],
            'data.attributes.incidentAddress' => ['sometimes', 'nullable', 'string', 'max:255'],
            'data.attributes.latitude' => [
                'sometimes',
                'required_with:data.attributes.longitude',
                'numeric',
                'between:-90,90',
            ],
            'data.attributes.longitude' => [
                'sometimes',
                'required_with:data.attributes.latitude',
                'numeric',
                'between:-180,180',
            ],
            'data.attributes.locationSource' => [
                'sometimes',
                'required_with:data.attributes.latitude',
                'string',
                'in:device,manual',
            ],
        ];
    }
}

