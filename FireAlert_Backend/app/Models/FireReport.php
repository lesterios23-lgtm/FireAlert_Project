<?php

namespace App\Models;

use App\Http\Filters\V1\QueryFilter;
use Database\Factories\FireReportFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;

class FireReport extends Model
{
    /** @use HasFactory<FireReportFactory> */
    use HasFactory;

    protected $fillable = [
        'resident_id',
        'user_id',
        'incident_description',
        'incident_address',
        'landmark_address',
        'latitude',
        'longitude',
        'location_source',
        'status',
        'reported_at',
    ];

    protected $appends = [
        'id',
        'resident_id',
        'incident_description',
        'incident_address',
        'latitude',
        'longitude',
        'location_source',
        'status',
        'reported_at',
    ];

    public function getKeyName()
    {
        return Schema::hasColumn($this->getTable(), 'report_id')
            ? 'report_id'
            : parent::getKeyName();
    }

    public function getCreatedAtColumn()
    {
        return Schema::hasColumn($this->getTable(), 'created_at')
            ? parent::getCreatedAtColumn()
            : null;
    }

    public function getUpdatedAtColumn()
    {
        return Schema::hasColumn($this->getTable(), 'updated_at')
            ? parent::getUpdatedAtColumn()
            : null;
    }

    public static function residentForeignKey(): string
    {
        return Schema::hasColumn('fire_reports', 'user_id') ? 'user_id' : 'resident_id';
    }

    public static function columnFor(string $attribute): string
    {
        return match ($attribute) {
            'status' => Schema::hasColumn('fire_reports', 'status_id') ? 'status_id' : 'status',
            'incidentAddress' => Schema::hasColumn('fire_reports', 'landmark_address')
                ? 'landmark_address'
                : 'incident_address',
            'reportedAt', 'createdAt' => Schema::hasColumn('fire_reports', 'submitted_at')
                ? 'submitted_at'
                : ($attribute === 'createdAt' ? 'created_at' : 'reported_at'),
            default => $attribute,
        };
    }

    /**
     * The legacy FireAlert schema stores coordinates in a separate table.
     *
     * @param  array<string, mixed>  $attributes
     */
    public static function createFromApi(array $attributes): static
    {
        return DB::transaction(function () use ($attributes): static {
            $latitude = Arr::pull($attributes, 'latitude');
            $longitude = Arr::pull($attributes, 'longitude');

            if (! Schema::hasColumn('fire_reports', 'latitude')) {
                unset($attributes['location_source']);
            } else {
                $attributes['latitude'] = $latitude;
                $attributes['longitude'] = $longitude;
            }

            $report = static::create($attributes);
            $report->saveCoordinates($latitude, $longitude);

            return $report;
        });
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function updateFromApi(array $attributes): void
    {
        $latitude = Arr::pull($attributes, 'latitude');
        $longitude = Arr::pull($attributes, 'longitude');

        if (! Schema::hasColumn('fire_reports', 'latitude')) {
            unset($attributes['location_source']);
        } else {
            $attributes['latitude'] = $latitude;
            $attributes['longitude'] = $longitude;
        }

        $this->update($attributes);
        $this->saveCoordinates($latitude, $longitude);
    }

    /**
     * @param  list<string>  $statuses
     * @return list<int|string>
     */
    public static function statusIdsForValues(array $statuses): array
    {
        if (! Schema::hasColumn('fire_reports', 'status_id')) {
            return $statuses;
        }

        $names = array_map(static fn (string $status): string => match ($status) {
            'pending' => 'Submitted',
            'accepted' => 'Received',
            'responding' => 'En Route',
            'resolved' => 'Resolved',
            'rejected' => 'Rejected',
            default => '',
        }, $statuses);

        return DB::table('response_statuses')
            ->whereIn(DB::raw('LOWER(status_name)'), array_map('mb_strtolower', array_filter($names)))
            ->pluck('status_id')
            ->all();
    }

    /**
     * @return list<string>
     */
    public static function availableStatusValues(): array
    {
        if (! Schema::hasColumn('fire_reports', 'status_id')) {
            return ['pending', 'accepted', 'responding', 'resolved', 'rejected'];
        }

        return DB::table('response_statuses')
            ->pluck('status_name')
            ->map(static fn (string $name): ?string => match (strtolower($name)) {
                'submitted' => 'pending',
                'received', 'dispatched' => 'accepted',
                'en route', 'arrived' => 'responding',
                'resolved' => 'resolved',
                'rejected' => 'rejected',
                default => null,
            })
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    public function getIdAttribute(): mixed
    {
        return $this->attributes[$this->getKeyName()] ?? null;
    }

    public function getResidentIdAttribute(): mixed
    {
        return $this->attributes[static::residentForeignKey()] ?? null;
    }

    public function setResidentIdAttribute(mixed $value): void
    {
        $this->attributes[static::residentForeignKey()] = $value;
    }

    public function getIncidentDescriptionAttribute(?string $value): ?string
    {
        return $this->attributes['additional_notes'] ?? $value;
    }

    public function setIncidentDescriptionAttribute(string $value): void
    {
        $column = Schema::hasColumn($this->getTable(), 'additional_notes')
            ? 'additional_notes'
            : 'incident_description';
        $this->attributes[$column] = $value;

        if (Schema::hasColumn($this->getTable(), 'fire_severity')) {
            preg_match('/Estimated fire size:\s*(small|medium|large)/i', $value, $matches);
            $this->attributes['fire_severity'] = isset($matches[1])
                ? ucfirst(strtolower($matches[1]))
                : 'Unspecified';
        }
    }

    public function getIncidentAddressAttribute(?string $value): ?string
    {
        return $this->attributes['landmark_address'] ?? $value;
    }

    public function setIncidentAddressAttribute(?string $value): void
    {
        $column = Schema::hasColumn($this->getTable(), 'landmark_address')
            ? 'landmark_address'
            : 'incident_address';
        $this->attributes[$column] = $value;
    }

    public function getLatitudeAttribute(mixed $value): mixed
    {
        if (array_key_exists('latitude', $this->attributes)) {
            return is_numeric($value) ? number_format((float) $value, 7, '.', '') : $value;
        }

        $latitude = $this->locationCoordinates()['latitude'] ?? null;

        return is_numeric($latitude) ? number_format((float) $latitude, 7, '.', '') : $latitude;
    }

    public function getLongitudeAttribute(mixed $value): mixed
    {
        if (array_key_exists('longitude', $this->attributes)) {
            return is_numeric($value) ? number_format((float) $value, 7, '.', '') : $value;
        }

        $longitude = $this->locationCoordinates()['longitude'] ?? null;

        return is_numeric($longitude) ? number_format((float) $longitude, 7, '.', '') : $longitude;
    }

    public function getLocationSourceAttribute(?string $value): ?string
    {
        return $value;
    }

    public function getStatusAttribute(?string $value): ?string
    {
        if (! array_key_exists('status_id', $this->attributes)) {
            return $value;
        }

        $statusName = DB::table('response_statuses')
            ->where('status_id', $this->attributes['status_id'])
            ->value('status_name');

        return match (strtolower((string) $statusName)) {
            'submitted' => 'pending',
            'received', 'dispatched' => 'accepted',
            'en route', 'arrived' => 'responding',
            'resolved' => 'resolved',
            default => null,
        };
    }

    public function setStatusAttribute(string $value): void
    {
        if (! Schema::hasColumn($this->getTable(), 'status_id')) {
            $this->attributes['status'] = $value;

            return;
        }

        $statusName = match ($value) {
            'pending' => 'Submitted',
            'accepted' => 'Received',
            'responding' => 'En Route',
            'resolved' => 'Resolved',
            'rejected' => 'Rejected',
            default => null,
        };
        $statusId = $statusName === null
            ? null
            : DB::table('response_statuses')
                ->whereRaw('LOWER(status_name) = ?', [mb_strtolower($statusName)])
                ->value('status_id');

        if ($statusId === null) {
            throw ValidationException::withMessages([
                'data.attributes.status' => "The {$value} status is not configured for reports.",
            ]);
        }

        $this->attributes['status_id'] = $statusId;
    }

    public function getReportedAtAttribute(mixed $value): mixed
    {
        return $this->attributes['submitted_at'] ?? $value;
    }

    public function setReportedAtAttribute(mixed $value): void
    {
        $column = Schema::hasColumn($this->getTable(), 'submitted_at')
            ? 'submitted_at'
            : 'reported_at';
        $this->attributes[$column] = $value;
    }

    public function getCreatedAtAttribute(mixed $value): mixed
    {
        return $value ?? $this->attributes['submitted_at'] ?? null;
    }

    public function getUpdatedAtAttribute(mixed $value): mixed
    {
        return $value;
    }

    public function saveCoordinates(mixed $latitude, mixed $longitude): void
    {
        if ($latitude === null || $longitude === null) {
            return;
        }

        if (Schema::hasColumn($this->getTable(), 'latitude')
            && Schema::hasColumn($this->getTable(), 'longitude')) {
            $this->setAttribute('latitude', $latitude);
            $this->setAttribute('longitude', $longitude);
            $this->save();

            return;
        }

        if (Schema::hasTable('report_locations')) {
            DB::table('report_locations')->updateOrInsert(
                ['report_id' => $this->getKey()],
                ['latitude' => $latitude, 'longitude' => $longitude],
            );
        }
    }

    private function locationCoordinates(): array
    {
        if (! Schema::hasTable('report_locations')) {
            return [];
        }

        $location = DB::table('report_locations')
            ->where('report_id', $this->getKey())
            ->first(['latitude', 'longitude']);

        return $location ? (array) $location : [];
    }

    public function resident(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            static::residentForeignKey(),
            (new User())->getKeyName(),
        );
    }

    public function evidence(): HasMany
    {
        return $this->hasMany(ReportEvidence::class, 'report_id', $this->getKeyName());
    }

    public function scopeFilter(Builder $builder, QueryFilter $filters): Builder
    {
        return $filters->apply($builder);
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
