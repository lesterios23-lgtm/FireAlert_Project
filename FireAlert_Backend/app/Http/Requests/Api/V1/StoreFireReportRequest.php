<?php

namespace App\Http\Requests\Api\V1;

class StoreFireReportRequest extends BaseFireReportRequest
{
    public function authorize(): bool
    {
        return true;
    }

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
}
