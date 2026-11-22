<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BarangayRiskReference extends Model
{
    protected $fillable = [
        'barangay_name',
        'latitude',
        'longitude',
        'reference_risk_level',
        'risk_description',
        'data_source',
        'verification_status',
        'reference_last_updated_at',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'reference_last_updated_at' => 'datetime',
        ];
    }
}
