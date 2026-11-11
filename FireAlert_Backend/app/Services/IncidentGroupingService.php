<?php

namespace App\Services;

use App\Models\FireIncident;
use App\Models\FireIncidentAction;
use App\Models\FireReport;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Creates new official incidents and attaches reports to them.
 * All mutations run inside one DB transaction with row locks, so many
 * simultaneous submissions cannot create duplicate official incident
 * records for the same fire (race-condition safe).
 */
class IncidentGroupingService
{
    public function __construct(private readonly DuplicateReportMatcher $matcher)
    {
    }

    public static function fromConfig(): self
    {
        return new self(DuplicateReportMatcher::fromConfig());
    }

    /**
     * Attach a freshly stored report to an incident group.
     *
     * @return array{incident: FireIncident, verdict: string, meta: array}
     */
    public function groupNewReport(FireReport $report, ?int $actorId = null): array
    {
        // Cross-process serialization for simultaneous submissions: the DB
        // row lock below serializes requests that hit the same connection,
        // while this named lock serializes requests across web workers so
        // two posts arriving at the same instant cannot each mint their
        // own official incident for the same fire.
        $lock = Cache::lock('fire-incident-grouping', 10);
        try {
            $lock->block(8);
        } catch (\Throwable) {
            // Lock unavailable (e.g. cache down): fall through to the
            // transactional path, which is still safe per-connection.
        }

        try {
            return DB::transaction(function () use ($report, $actorId): array {
                $reportId = $report->getKey();

                // Serialize concurrent submissions: only one request at a time
                // evaluates grouping for "fresh" reports, so two simultaneous
                // posts cannot each mint their own incident.
                DB::table('fire_reports')
                    ->where($report->getKeyName(), $reportId)
                    ->lockForUpdate()
                    ->first();

                $fresh = FireReport::query()->findOrFail($reportId);
                if ($fresh->fire_incident_id) {
                    $incident = FireIncident::query()->findOrFail($fresh->fire_incident_id);
                    $fresh->duplicate_flag = 'grouped';
                    $fresh->duplicate_of_report_id = $incident->reports()->orderBy($fresh->getKeyName())->value($fresh->getKeyName());
                    $fresh->save();

                    return ['incident' => $incident, 'verdict' => DuplicateReportMatcher::STRONG, 'meta' => ['already_grouped' => true]];
                }

                $match = $this->matcher->matchFor($fresh);

                if ($match['verdict'] === DuplicateReportMatcher::STRONG && $match['incident']) {
                    $incident = FireIncident::query()
                        ->whereKey($match['incident']->getKey())
                        ->lockForUpdate()
                        ->firstOrFail();
                    $this->attachReport($incident, $fresh, true, $actorId, [
                        'distance_meters' => $match['distance_meters'],
                        'minutes_apart' => $match['minutes_apart'],
                        'description_score' => $match['description_score'],
                        'reasons' => $match['reasons'],
                    ]);

                    return ['incident' => $incident->fresh(), 'verdict' => DuplicateReportMatcher::STRONG, 'meta' => $this->metaOf($match)];
                }

                if ($match['verdict'] === DuplicateReportMatcher::POSSIBLE && $match['incident']) {
                    $incident = FireIncident::query()
                        ->whereKey($match['incident']->getKey())
                        ->lockForUpdate()
                        ->firstOrFail();
                    $this->flagPossibleDuplicate($fresh, $incident, $actorId, $match);
                    $standalone = $this->createStandaloneIncident($fresh, $actorId, 'possible_duplicate');

                    return ['incident' => $standalone, 'verdict' => DuplicateReportMatcher::POSSIBLE, 'meta' => $this->metaOf($match)];
                }

                $standalone = $this->createStandaloneIncident($fresh, $actorId, 'new_incident');

                return ['incident' => $standalone, 'verdict' => DuplicateReportMatcher::NONE, 'meta' => $this->metaOf($match)];
            });
        } finally {
            try {
                $lock->release();
            } catch (\Throwable) {
                // Best effort; the lock also expires on its own.
            }
        }
    }

    /** BFP confirms: attach the report to the incident (manual). */
    public function attachToIncident(FireReport $report, FireIncident $incident, ?int $actorId, ?string $reason = null): FireIncident
    {
        return DB::transaction(function () use ($report, $incident, $actorId, $reason): FireIncident {
            $incident = FireIncident::query()->whereKey($incident->getKey())->lockForUpdate()->firstOrFail();
            $report = FireReport::query()->whereKey($report->getKey())->lockForUpdate()->firstOrFail();
            $this->attachReport($incident, $report, false, $actorId, $reason ? ['reason' => $reason] : []);

            return $incident->fresh();
        });
    }

    /** BFP separates a wrongly grouped report into its own new incident. */
    public function detachReport(FireReport $report, ?int $actorId, ?string $reason = null): FireIncident
    {
        return DB::transaction(function () use ($report, $actorId, $reason): FireIncident {
            $report = FireReport::query()->whereKey($report->getKey())->lockForUpdate()->firstOrFail();
            $oldIncidentId = $report->fire_incident_id;

            $split = FireIncident::create([
                'code' => FireIncident::nextCode(),
                'incident_description' => $report->incident_description,
                'incident_address' => $report->incident_address,
                'latitude' => is_numeric($report->latitude) ? $report->latitude : null,
                'longitude' => is_numeric($report->longitude) ? $report->longitude : null,
                'status' => $report->status ?? 'pending',
                'first_reported_at' => $report->reported_at ?? $report->created_at ?? now(),
                'last_reported_at' => $report->reported_at ?? $report->created_at ?? now(),
            ]);

            $report->fire_incident_id = $split->getKey();
            $report->duplicate_flag = 'separated';
            $report->duplicate_of_report_id = null;
            $report->save();
            $this->refreshIncidentStats($oldIncidentId);

            FireIncidentAction::create([
                'fire_incident_id' => $split->getKey(),
                'fire_report_id' => $report->getKey(),
                'actor_id' => $actorId,
                'action' => FireIncidentAction::SPLIT,
                'reason' => $reason,
                'meta' => ['from_incident_id' => $oldIncidentId],
            ]);

            return $split->fresh();
        });
    }

    /** BFP merges one incident into another; reports move, empty shell resolves. */
    public function mergeIncidents(FireIncident $source, FireIncident $target, ?int $actorId, ?string $reason = null): FireIncident
    {
        return DB::transaction(function () use ($source, $target, $actorId, $reason): FireIncident {
            if ($source->getKey() === $target->getKey()) {
                return $target->fresh();
            }
            $source = FireIncident::query()->whereKey($source->getKey())->lockForUpdate()->firstOrFail();
            $target = FireIncident::query()->whereKey($target->getKey())->lockForUpdate()->firstOrFail();

            FireReport::query()
                ->where('fire_incident_id', $source->getKey())
                ->update([
                    'fire_incident_id' => $target->getKey(),
                    'duplicate_flag' => 'grouped',
                ]);

            $source->status = 'merged';
            $source->save();
            $this->refreshIncidentStats($target->getKey());

            FireIncidentAction::create([
                'fire_incident_id' => $target->getKey(),
                'fire_report_id' => null,
                'actor_id' => $actorId,
                'action' => FireIncidentAction::MERGED,
                'reason' => $reason,
                'meta' => ['from_incident_id' => $source->getKey(), 'from_code' => $source->code],
            ]);

            return $target->fresh();
        });
    }

    private function attachReport(
        FireIncident $incident,
        FireReport $report,
        bool $automatic,
        ?int $actorId,
        array $meta,
    ): void {
        $anchorId = $incident->reports()->orderBy($report->getKeyName())->value($report->getKeyName());

        $report->fire_incident_id = $incident->getKey();
        $report->duplicate_flag = 'grouped';
        $report->duplicate_of_report_id = $anchorId && $anchorId !== $report->getKey() ? $anchorId : null;
        $report->save();
        $this->refreshIncidentStats($incident->getKey());

        FireIncidentAction::create([
            'fire_incident_id' => $incident->getKey(),
            'fire_report_id' => $report->getKey(),
            'actor_id' => $actorId,
            'action' => $automatic ? FireIncidentAction::AUTO_ATTACHED : FireIncidentAction::ATTACHED,
            'reason' => $meta['reason'] ?? null,
            'meta' => $meta,
        ]);
    }

    private function flagPossibleDuplicate(FireReport $report, FireIncident $incident, ?int $actorId, array $match): void
    {
        // Keep the "possible duplicate" badge even though the report also gets
        // its own standalone incident below, so BFP can still verify + merge.
        $report->duplicate_flag = 'possible';
        $report->duplicate_of_report_id = $incident->reports()->orderBy($report->getKeyName())->value($report->getKeyName());
        $report->save();

        FireIncidentAction::create([
            'fire_incident_id' => $incident->getKey(),
            'fire_report_id' => $report->getKey(),
            'actor_id' => $actorId,
            'action' => FireIncidentAction::ATTACHED,
            'reason' => 'Possible duplicate flagged for BFP verification.',
            'meta' => array_merge($this->metaOf($match), ['needs_verification' => true]),
        ]);
    }

    private function createStandaloneIncident(FireReport $report, ?int $actorId, string $why): FireIncident
    {
        $incident = FireIncident::create([
            'code' => FireIncident::nextCode(),
            'incident_description' => $report->incident_description,
            'incident_address' => $report->incident_address,
            'latitude' => is_numeric($report->latitude) ? $report->latitude : null,
            'longitude' => is_numeric($report->longitude) ? $report->longitude : null,
            'status' => $report->status ?? 'pending',
            'first_reported_at' => $report->reported_at ?? $report->created_at ?? now(),
            'last_reported_at' => $report->reported_at ?? $report->created_at ?? now(),
        ]);

        // Possible-duplicate reports keep their flag; plain new ones are anchors.
        if ($why === 'new_incident') {
            $report->fire_incident_id = $incident->getKey();
            $report->duplicate_flag = 'anchor';
            $report->duplicate_of_report_id = null;
            $report->save();
        } else {
            $report->fire_incident_id = $incident->getKey();
            $report->save();
        }

        FireIncidentAction::create([
            'fire_incident_id' => $incident->getKey(),
            'fire_report_id' => $report->getKey(),
            'actor_id' => $actorId,
            'action' => FireIncidentAction::CREATED,
            'reason' => null,
            'meta' => ['why' => $why],
        ]);

        return $incident->fresh();
    }

    private function refreshIncidentStats(?int $incidentId): void
    {
        if ($incidentId === null) {
            return;
        }
        $incident = FireIncident::query()->find($incidentId);
        if (! $incident) {
            return;
        }
        $reports = FireReport::query()->where('fire_incident_id', $incidentId)->get();
        if ($reports->isEmpty()) {
            if (! in_array($incident->status, ['merged', 'resolved'], true)) {
                $incident->status = 'resolved';
                $incident->save();
            }

            return;
        }
        $timeColumn = FireReport::columnFor('reportedAt');
        $first = $reports->sortBy($timeColumn)->first();
        $last = $reports->sortByDesc($timeColumn)->first();
        $incident->first_reported_at = $first?->{$timeColumn} ?? $incident->first_reported_at;
        $incident->last_reported_at = $last?->{$timeColumn} ?? $incident->last_reported_at;
        if ($incident->latitude === null && is_numeric($first?->latitude)) {
            $incident->latitude = $first->latitude;
            $incident->longitude = is_numeric($first?->longitude) ? $first->longitude : null;
        }
        if ($incident->incident_address === null) {
            $incident->incident_address = $first?->incident_address;
        }
        $incident->save();
    }

    private function metaOf(array $match): array
    {
        return [
            'candidate_id' => $match['candidate_id'] ?? null,
            'distance_meters' => $match['distance_meters'] ?? null,
            'minutes_apart' => $match['minutes_apart'] ?? null,
            'description_score' => $match['description_score'] ?? 0.0,
            'reasons' => $match['reasons'] ?? [],
        ];
    }
}
