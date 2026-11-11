<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Official incident group. One row per real-world fire; individual resident
 * submissions (fire_reports) are attached to it without being altered.
 */
class FireIncident extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'incident_description',
        'incident_address',
        'latitude',
        'longitude',
        'status',
        'first_reported_at',
        'last_reported_at',
    ];

    protected $casts = [
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'first_reported_at' => 'datetime',
        'last_reported_at' => 'datetime',
    ];

    public function reports(): HasMany
    {
        return $this->hasMany(FireReport::class, 'fire_incident_id');
    }

    public function actions(): HasMany
    {
        return $this->hasMany(FireIncidentAction::class, 'fire_incident_id');
    }

    /** Next INC-XXX code, zero-padded. Called inside the creation transaction. */
    public static function nextCode(): string
    {
        $last = static::query()
            ->where('code', 'like', 'INC-%')
            ->orderByDesc('id')
            ->value('code');

        $next = 1;
        if (is_string($last) && preg_match('/INC-(\d+)$/', $last, $matches)) {
            $next = ((int) $matches[1]) + 1;
        }

        return 'INC-'.str_pad((string) $next, 3, '0', STR_PAD_LEFT);
    }
}
