<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

abstract class BaseFireReportRequest extends FormRequest
{
    public function mappedAttributes(): array
    {
        $attributeMap = [
            'incidentDescription' => 'incident_description',
            'incidentAddress'     => 'incident_address',
            'latitude'            => 'latitude',
            'longitude'           => 'longitude',
            'locationSource'      => 'location_source',
        ];
        $attributes = $this->validated('data.attributes', []);
        $mappedAttributes = [];

        foreach ($attributeMap as $requestAttribute => $column) {
            if (array_key_exists($requestAttribute, $attributes)) {
                $mappedAttributes[$column] = $attributes[$requestAttribute];
            }
        }

        // Map the optional relationship: resident id (used by managers to assign ownership)
        $residentId = $this->validated('data.relationships.resident.data.id');
        if ($residentId !== null) {
            $mappedAttributes['resident_id'] = $residentId;
        }

        return $mappedAttributes;
    }

    public function messages(): array
    {
        return [
            'data.type.in' => 'The data.type value must be fire_report.',
        ];
    }
}
