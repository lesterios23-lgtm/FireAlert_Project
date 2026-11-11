<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Audit trail for incident grouping: every attach / detach / split / merge /
 * resolve action, who did it, and why.
 */
class FireIncidentAction extends Model
{
    public const ATTACHED = 'attached';

    public const AUTO_ATTACHED = 'auto_attached';

    public const DETACHED = 'detached';

    public const MERGED = 'merged';

    public const SPLIT = 'split';

    public const STATUS_CHANGED = 'status_changed';

    public const CREATED = 'created';

    protected $fillable = [
        'fire_incident_id',
        'fire_report_id',
        'actor_id',
        'action',
        'reason',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function incident(): BelongsTo
    {
        return $this->belongsTo(FireIncident::class, 'fire_incident_id');
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(FireReport::class, 'fire_report_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
