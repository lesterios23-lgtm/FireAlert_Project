<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportEvidence extends Model
{
    protected $table = 'report_evidence';

    protected $primaryKey = 'evidence_id';

    public $timestamps = false;

    protected $fillable = [
        'report_id',
        'storage_path',
        'original_name',
        'mime_type',
        'file_size',
        'uploaded_at',
    ];

    protected function casts(): array
    {
        return [
            'uploaded_at' => 'datetime',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(FireReport::class, 'report_id', (new FireReport())->getKeyName());
    }
}
