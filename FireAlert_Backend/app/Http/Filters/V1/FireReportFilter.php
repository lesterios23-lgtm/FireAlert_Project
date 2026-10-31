<?php

namespace App\Http\Filters\V1;

use Illuminate\Validation\ValidationException;

class FireReportFilter extends QueryFilter
{
    protected array $sortable = [
        'status' => 'status',
        'incidentAddress' => 'incident_address',
        'reportedAt' => 'reported_at',
        'createdAt' => 'created_at',
    ];

    public function status(mixed $value): void
    {
        $statuses = $this->commaSeparatedValues($value);

        if ($statuses !== []) {
            $this->builder->whereIn('status', $statuses);
        }
    }

    public function incidentAddress(mixed $value): void
    {
        if (! is_string($value)) {
            return;
        }

        $pattern = str_replace(['!', '%', '_', '*'], ['!!', '!%', '!_', '%'], $value);

        $this->builder->whereRaw("incident_address LIKE ? ESCAPE '!' ", [$pattern]);
    }

    public function include(mixed $value): void
    {
        if (! is_string($value)) {
            return;
        }

        $requestedIncludes = array_map('trim', explode(',', strtolower($value)));
        $allowedIncludes = array_intersect(['resident'], $requestedIncludes);

        if ($allowedIncludes !== []) {
            $this->builder->with('resident:id,name');
        }
    }

    public function reportedAt(mixed $value): void
    {
        $dates = $this->commaSeparatedValues($value);

        if (count($dates) < 1 || count($dates) > 2) {
            $this->invalidReportedAt();
        }

        foreach ($dates as $date) {
            if (! $this->isValidDate($date)) {
                $this->invalidReportedAt();
            }
        }

        if (count($dates) === 1) {
            $this->builder->whereDate('reported_at', $dates[0]);

            return;
        }

        if (count($dates) === 2) {
            if ($dates[0] > $dates[1]) {
                throw ValidationException::withMessages([
                    'reportedAt' => 'The start date must be on or before the end date.',
                ]);
            }

            $this->builder->whereBetween('reported_at', [
                $dates[0].' 00:00:00',
                $dates[1].' 23:59:59.999999',
            ]);

            return;
        }

        $this->invalidReportedAt();
    }

    /**
     * @return list<string>
     */
    private function commaSeparatedValues(mixed $value): array
    {
        if (! is_string($value)) {
            return [];
        }

        return array_values(array_filter(
            array_map('trim', explode(',', $value)),
            static fn (string $item): bool => $item !== '',
        ));
    }

    private function isValidDate(string $date): bool
    {
        if (! preg_match('/\A\d{4}-\d{2}-\d{2}\z/', $date)) {
            return false;
        }

        return checkdate((int) substr($date, 5, 2), (int) substr($date, 8, 2), (int) substr($date, 0, 4));
    }

    private function invalidReportedAt(): never
    {
        throw ValidationException::withMessages([
            'reportedAt' => 'Provide a valid date or a valid start and end date separated by a comma.',
        ]);
    }
}
