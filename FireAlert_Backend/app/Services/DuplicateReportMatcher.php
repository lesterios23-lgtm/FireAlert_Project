<?php

namespace App\Services;

use App\Models\FireIncident;
use App\Models\FireReport;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Decides whether a newly submitted fire report refers to an already-known
 * active incident (STRONG match), looks similar but uncertain (POSSIBLE
 * duplicate for BFP verification), or starts a NEW official incident.
 *
 * Signals (all configurable via config/firealert.php):
 *  - geographic proximity (Haversine meters vs radius_meters)
 *  - submission time gap (minutes vs window_minutes)
 *  - fire-size/type compatibility parsed from the description
 *  - description word-overlap as supporting evidence
 *
 * Never merges on location alone: a coordinating report needs at least
 * same-barangay text, a description signal, or a very tight GPS pin.
 */
class DuplicateReportMatcher
{
    public const STRONG = 'strong';

    public const POSSIBLE = 'possible';

    public const NONE = 'none';

    public function __construct(
        private readonly float $radiusMeters,
        private readonly int $windowMinutes,
        private readonly float $descriptionThreshold,
        private readonly float $tightRadiusMeters,
        /** @var list<string> */
        private readonly array $activeStatuses,
    ) {
    }

    public static function fromConfig(): self
    {
        $config = config('firealert.duplicate_detection', []);

        return new self(
            (float) ($config['radius_meters'] ?? 200),
            (int) ($config['window_minutes'] ?? 15),
            (float) ($config['description_threshold'] ?? 0.35),
            (float) ($config['tight_radius_meters'] ?? 60),
            (array) ($config['active_statuses'] ?? ['pending', 'accepted', 'responding', 'arrived']),
        );
    }

    /**
     * @return array{verdict: string, incident: ?FireIncident, distance_meters: ?float, minutes_apart: ?float, description_score: float, reasons: list<string>, candidate_id: ?int}
     */
    public function matchFor(FireReport $report): array
    {
        $candidates = $this->activeCandidateIncidents($report);
        if ($candidates->isEmpty()) {
            return $this->result(self::NONE, null, null, null, 0.0, ['No active incidents to compare against.']);
        }

        $reportSize = self::fireSizeOf($report->incident_description);
        $reportBarangay = self::barangayOf($report->incident_address);
        $reportPoint = $this->pointOf($report);

        $best = null;
        foreach ($candidates as $incident) {
            $score = $this->scoreCandidate($incident, $report, $reportSize, $reportBarangay, $reportPoint);
            if ($best === null || $score['rank'] > $best['rank']) {
                $best = $score;
            }
        }

        if ($best === null || $best['verdict'] === self::NONE) {
            return $this->result(self::NONE, null, null, null, (float) ($best['description_score'] ?? 0.0), $best['reasons'] ?? ['No matching active incident.']);
        }

        return $this->result(
            $best['verdict'],
            $best['incident'],
            $best['distance_meters'],
            $best['minutes_apart'],
            $best['description_score'],
            $best['reasons'],
            $best['incident']->getKey(),
        );
    }

    /** Active incidents (with their reports) eligible for matching. */
    private function activeCandidateIncidents(FireReport $report): Collection
    {
        $statuses = FireReport::statusIdsForValues($this->activeStatuses);

        return FireIncident::query()
            ->whereIn('status', FireReport::availableStatusValues()
                ? $this->mapToIncidentStatuses()
                : $this->activeStatuses)
            ->where(function ($query) use ($statuses) {
                // An incident is active when its own status is active OR it
                // still holds at least one active report.
                $query->whereIn('status', $this->activeStatuses)
                    ->orWhereHas('reports', function ($reportQuery) use ($statuses) {
                        $column = FireReport::columnFor('status');
                        $reportQuery->whereIn($column, $statuses);
                    });
            })
            ->where('id', '!=', $report->fire_incident_id ?? 0)
            ->with(['reports' => function ($query) {
                $query->orderBy(FireReport::columnFor('reportedAt'))->limit(25);
            }])
            ->orderByDesc('first_reported_at')
            ->limit(50)
            ->get()
            // Exclude incidents quarantined to a single detached report that
            // BFP already separated (they must never auto-catch new reports).
            ->reject(fn (FireIncident $incident) => (bool) ($incident->reports->count() === 1 && $incident->reports->first()?->duplicate_flag === 'separated'))
            ->values();
    }

    /** Incident-level statuses mirror report statuses. */
    private function mapToIncidentStatuses(): array
    {
        return $this->activeStatuses;
    }

    /** @return array{verdict: string, incident: FireIncident, distance_meters: ?float, minutes_apart: ?float, description_score: float, reasons: list<string>, rank: float} */
    private function scoreCandidate(
        FireIncident $incident,
        FireReport $report,
        ?string $reportSize,
        ?string $reportBarangay,
        ?array $reportPoint,
    ): array {
        $reasons = [];
        $rank = 0.0;

        $incidentPoint = $this->pointOf($incident);
        $distance = ($reportPoint && $incidentPoint)
            ? self::haversineMeters($reportPoint[0], $reportPoint[1], $incidentPoint[0], $incidentPoint[1])
            : null;

        $minutesApart = $this->minutesBetween($report->reported_at, $incident->first_reported_at);
        if ($minutesApart === null) {
            $minutesApart = $this->minutesBetween($report->reported_at, $incident->created_at);
        }

        $withinRadius = $distance !== null && $distance <= $this->radiusMeters;
        $withinTightRadius = $distance !== null && $distance <= $this->tightRadiusMeters;
        $withinWindow = $minutesApart !== null && abs($minutesApart) <= $this->windowMinutes;

        if ($distance !== null) {
            $reasons[] = sprintf('%.0f m from %s', $distance, $incident->code);
            // Closer pins rank higher (0 near edge -> ~1 at same spot).
            $rank += max(0.0, 1 - ($distance / max($this->radiusMeters, 1))) * 2;
        } else {
            $reasons[] = 'No GPS coordinates to compare';
        }
        $reasons[] = $minutesApart === null
            ? 'Submission time unavailable'
            : sprintf('%.1f min from first report', abs($minutesApart));

        // Fire-size compatibility (severity parsed from "Estimated fire size: X").
        $incidentSizes = $incident->reports
            ->map(fn (FireReport $row) => self::fireSizeOf($row->incident_description))
            ->filter()
            ->unique()
            ->values();
        $sizeCompatible = $reportSize === null
            || $incidentSizes->isEmpty()
            || $incidentSizes->contains($reportSize);
        if (! $sizeCompatible) {
            $reasons[] = sprintf('Fire size differs (report: %s vs incident: %s)', $reportSize, $incidentSizes->implode(', '));
            $rank -= 1.5;
        } elseif ($reportSize !== null) {
            $reasons[] = sprintf('Fire size compatible (%s)', $reportSize);
            $rank += 0.5;
        }

        // Same-barangay text ("Brgy. X, Mansalay") is strong area evidence.
        $incidentBarangays = $incident->reports
            ->map(fn (FireReport $row) => self::barangayOf($row->incident_address))
            ->filter()
            ->unique()
            ->values();
        $sameBarangay = $reportBarangay !== null
            && ($incidentBarangays->contains($reportBarangay)
                || self::barangayOf($incident->incident_address) === $reportBarangay);
        if ($sameBarangay) {
            $reasons[] = sprintf('Same barangay (Brgy. %s)', $reportBarangay);
            $rank += 1.0;
        }

        // Description word-overlap vs the incident's anchor + member texts.
        $texts = collect([$incident->incident_description])
            ->merge($incident->reports->map(fn (FireReport $row) => $row->incident_description));
        $descriptionScore = $this->bestDescriptionScore((string) $report->incident_description, $texts);
        if ($descriptionScore > 0) {
            $reasons[] = sprintf('Description similarity %.2f', $descriptionScore);
            $rank += $descriptionScore;
        } else {
            $reasons[] = 'No usable description overlap';
        }

        // ---- Verdict ----
        // A. STRONG: geo + time + (description signal OR same barangay OR tight pin).
        if ($withinRadius && $withinWindow) {
            $supporting = $descriptionScore >= $this->descriptionThreshold || $sameBarangay;
            if ($supporting) {
                return [
                    'verdict' => self::STRONG,
                    'incident' => $incident,
                    'distance_meters' => $distance,
                    'minutes_apart' => $minutesApart,
                    'description_score' => $descriptionScore,
                    'reasons' => [...$reasons, 'Strong match: auto-attached as supporting report.'],
                    'rank' => $rank + 5,
                ];
            }
            // Tight GPS pins (same building) attach even with thin text.
            if ($withinTightRadius && $descriptionScore > 0) {
                return [
                    'verdict' => self::STRONG,
                    'incident' => $incident,
                    'distance_meters' => $distance,
                    'minutes_apart' => $minutesApart,
                    'description_score' => $descriptionScore,
                    'reasons' => [...$reasons, 'Strong match: very close pin with similar description.'],
                    'rank' => $rank + 5,
                ];
            }

            // B. POSSIBLE: geo + time line up but the system is uncertain.
            return [
                'verdict' => self::POSSIBLE,
                'incident' => $incident,
                'distance_meters' => $distance,
                'minutes_apart' => $minutesApart,
                'description_score' => $descriptionScore,
                'reasons' => [...$reasons, 'Possible duplicate: needs BFP verification.'],
                'rank' => $rank + 2,
            ];
        }

        // No-GPS fallback: same barangay + similar description + close in time.
        if ($distance === null && $sameBarangay && $withinWindow && $descriptionScore >= $this->descriptionThreshold) {
            return [
                'verdict' => self::POSSIBLE,
                'incident' => $incident,
                'distance_meters' => null,
                'minutes_apart' => $minutesApart,
                'description_score' => $descriptionScore,
                'reasons' => [...$reasons, 'Possible duplicate (no GPS): needs BFP verification.'],
                'rank' => $rank + 1,
            ];
        }

        return [
            'verdict' => self::NONE,
            'incident' => $incident,
            'distance_meters' => $distance,
            'minutes_apart' => $minutesApart,
            'description_score' => $descriptionScore,
            'reasons' => [...$reasons, 'Outside matching thresholds.'],
            'rank' => $rank - 5,
        ];
    }

    /** @return array{verdict: string, incident: ?FireIncident, distance_meters: ?float, minutes_apart: ?float, description_score: float, reasons: list<string>, candidate_id: ?int} */
    private function result(
        string $verdict,
        ?FireIncident $incident,
        ?float $distance,
        ?float $minutesApart,
        float $descriptionScore,
        array $reasons,
        ?int $candidateId = null,
    ): array {
        return [
            'verdict' => $verdict,
            'incident' => $incident,
            'distance_meters' => $distance,
            'minutes_apart' => $minutesApart,
            'description_score' => $descriptionScore,
            'reasons' => $reasons,
            'candidate_id' => $candidateId,
        ];
    }

    /** @return ?array{0: float, 1: float} */
    private function pointOf(object $row): ?array
    {
        $lat = $row->latitude ?? null;
        $lng = $row->longitude ?? null;
        if (! is_numeric($lat) || ! is_numeric($lng)) {
            return null;
        }

        return [(float) $lat, (float) $lng];
    }

    private function minutesBetween(mixed $a, mixed $b): ?float
    {
        try {
            if ($a === null || $b === null) {
                return null;
            }
            $a = $a instanceof Carbon ? $a : Carbon::parse($a);
            $b = $b instanceof Carbon ? $b : Carbon::parse($b);

            return abs($a->diffInMinutes($b, false));
        } catch (\Throwable) {
            return null;
        }
    }

    /** Best Jaccard word-overlap between the report text and any incident text. */
    private function bestDescriptionScore(string $reportText, Collection $texts): float
    {
        $reportTokens = self::tokens($reportText);
        if ($reportTokens === []) {
            return 0.0;
        }

        $best = 0.0;
        foreach ($texts as $text) {
            $tokens = self::tokens((string) $text);
            if ($tokens === []) {
                continue;
            }
            $intersection = count(array_intersect($reportTokens, $tokens));
            $union = count(array_unique([...$reportTokens, ...$tokens]));
            if ($union > 0) {
                $best = max($best, $intersection / $union);
            }
        }

        return $best;
    }

    /** Normalized keyword set: lowercase, keeps fire-relevant words (>=3 chars). */
    public static function tokens(string $text): array
    {
        $clean = mb_strtolower($text);
        $clean = preg_replace('/estimated fire size:\s*(small|medium|large)\.?/i', ' ', $clean) ?? $clean;
        $clean = preg_replace('/[^a-z\s]/', ' ', $clean) ?? $clean;
        $stopwords = ['the', 'and', 'for', 'with', 'near', 'from', 'that', 'this', 'nearby', 'our', 'are', 'was', 'were', 'has', 'have', 'had', 'there', 'here', 'please', 'help', 'fire'];
        $words = array_unique(array_filter(
            preg_split('/\s+/', $clean) ?: [],
            fn ($word) => mb_strlen($word) >= 3 && ! in_array($word, $stopwords, true),
        ));

        return array_values($words);
    }

    public static function fireSizeOf(?string $description): ?string
    {
        if (! is_string($description)) {
            return null;
        }
        if (preg_match('/estimated fire size:\s*(small|medium|large)/i', $description, $matches)) {
            return mb_strtolower($matches[1]);
        }

        return null;
    }

    /** Extracts "Brgy. <Name>" from the Mansalay-scoped address format. */
    public static function barangayOf(?string $address): ?string
    {
        if (! is_string($address)) {
            return null;
        }
        if (preg_match('/brgy\.\s*([^,]+)/i', $address, $matches)) {
            return mb_strtolower(trim($matches[1]));
        }

        return null;
    }

    public static function haversineMeters(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadius = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;

        return 2 * $earthRadius * asin(min(1, sqrt($a)));
    }
}
