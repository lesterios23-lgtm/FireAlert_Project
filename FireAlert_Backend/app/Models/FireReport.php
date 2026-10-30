<?php

namespace App\Models;

use Database\Factories\FireReportFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'resident_id',
    'incident_description',
    'incident_address',
    'latitude',
    'longitude',
    'location_source',
    'status',
    'reported_at',
])]
class FireReport extends Model
{
    /** @use HasFactory<FireReportFactory> */
    use HasFactory;

    public function resident(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resident_id');
    }

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'reported_at' => 'datetime',
        ];
    }
}
