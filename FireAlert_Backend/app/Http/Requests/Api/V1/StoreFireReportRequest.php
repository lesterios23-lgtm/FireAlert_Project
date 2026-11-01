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

    /**
     * When the request comes through the nested route /users/{user}/reports,
     * the resident id is in the URL, not the body. Copy it in so that the
     * same size:{id} rule applies uniformly.
     */
    protected function prepareForValidation(): void
    {
        // $this->route('user') is the bound User model from the URL segment
        if ($urlUser = $this->route('user')) {
            $this->merge([
                'data' => array_merge($this->input('data', []), [
                    'relationships' => array_merge(
                        $this->input('data.relationships', []),
                        ['resident' => ['data' => ['id' => $urlUser->id]]]
                    ),
                ]),
            ]);
        }
    }

    public function rules(): array
    {
        $user = $this->user();

        $rules = [
            'data'                                         => ['required', 'array:type,attributes,relationships'],
            'data.type'                                    => ['sometimes', 'string', 'in:fire_report'],
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
