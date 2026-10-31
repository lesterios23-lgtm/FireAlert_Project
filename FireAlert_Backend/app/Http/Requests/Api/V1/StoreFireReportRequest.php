<?php

namespace App\Http\Requests\Api\V1;

use App\Permissions\V1\Abilities;

/**
 * Validates the body of POST /reports and POST /users/{user}/reports.
 */
class StoreFireReportRequest extends BaseFireReportRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $user = $this->user();

        $rules = [
            'data'                                         => ['required', 'array:type,attributes,relationships'],
            'data.type'                                    => ['required', 'string', 'in:fire_report'],
            'data.attributes'                              => [
                'required',
                'array:incidentDescription,incidentAddress,latitude,longitude,locationSource',
            ],
            'data.attributes.incidentDescription'         => ['required', 'string'],
            'data.attributes.incidentAddress'             => [
                'nullable',
                'required_without_all:data.attributes.latitude,data.attributes.longitude',
                'string',
                'max:255',
            ],
            'data.attributes.latitude'                    => [
                'required_with:data.attributes.longitude',
                'numeric',
                'between:-90,90',
            ],
            'data.attributes.longitude'                   => [
                'required_with:data.attributes.latitude',
                'numeric',
                'between:-180,180',
            ],
            'data.attributes.locationSource'              => [
                'required_with:data.attributes.latitude',
                'string',
                'in:device,manual',
            ],
            'data.relationships.resident.data.id'         => ['sometimes', 'integer', 'exists:users,id'],
        ];

        // A resident who may only create their own reports must be the author.
        // size:{id} means the submitted id must exactly equal the logged-in user's id.
        if ($user->tokenCan(Abilities::CreateOwnReport)) {
            $rules['data.relationships.resident.data.id'] = ['sometimes', 'integer', 'size:' . $user->id];
        }

        return $rules;
    }
}
