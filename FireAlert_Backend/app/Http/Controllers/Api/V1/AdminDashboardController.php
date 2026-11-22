<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Resources\V1\FireReportResource;
use App\Models\BarangayRiskReference;
use App\Models\FireReport;
use App\Models\User;
use App\Services\LoginAttemptSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class AdminDashboardController extends APIController
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user() && $request->user()->role === 'admin', 403, 'Admin access required.');

        $reports = FireReport::query()
            ->with('resident')
            ->orderByDesc(FireReport::columnFor('reportedAt'))
            ->get()
            ->map(fn (FireReport $report): array => (new FireReportResource($report))->resolve($request));

        return $this->ok('System administrator data retrieved', [
            'reports' => $reports,
            'users' => $this->users(),
            'login_attempt_settings' => app(LoginAttemptSettings::class)->get(),
            'high_risk_summary' => $this->highRiskSummary(),
            'firetrucks' => DB::table('firetrucks as trucks')
                ->orderBy('trucks.unit_name')
                ->get([
                    'trucks.truck_id',
                    'trucks.unit_name',
                    'trucks.plate_number',
                    'trucks.status',
                ]),
        ]);
    }

    public function highRiskAreas(Request $request): JsonResponse
    {
        abort_unless($request->user() && $request->user()->role === 'admin', 403, 'Admin access required.');
        $period = $this->normalizeRiskPeriod($request->query('period'));

        return $this->ok('High-risk location analysis retrieved', $this->buildHighRiskAnalysis($period));
    }

    public function updateLoginAttemptSettings(Request $request): JsonResponse
    {
        abort_unless($request->user() && $request->user()->role === 'admin', 403, 'Admin access required.');
        $settings = $request->validate([
            'max_attempts' => ['required', 'integer', 'min:1', 'max:20'],
            'lockout_minutes' => ['required', 'integer', 'min:1', 'max:1440'],
        ]);

        return $this->ok(
            'Login attempt settings updated',
            app(LoginAttemptSettings::class)->update($settings),
        );
    }

    public function storeUser(Request $request): JsonResponse
    {
        abort_unless($request->user() && $request->user()->role === 'admin', 403, 'Admin access required.');
        $attributes = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'contact_number' => ['required', 'string', 'max:20'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in([User::ROLE_RESIDENT, User::ROLE_BFP])],
            'personnel.badge_number' => ['required_if:role,bfp', 'nullable', 'string', 'max:50', 'unique:bfp_personnel,badge_number'],
            'personnel.rank_position' => ['required_if:role,bfp', 'nullable', 'string', 'max:100'],
        ]);

        $user = DB::transaction(function () use ($attributes): User {
            $user = User::create([
                'name' => $attributes['name'],
                'contact_number' => $attributes['contact_number'],
                'email' => $attributes['email'],
                'password' => Hash::make($attributes['password']),
                'role' => $attributes['role'],
            ]);

            if ($attributes['role'] === User::ROLE_BFP) {
                DB::table('bfp_personnel')->insert([
                    'user_id' => $user->getKey(),
                    'badge_number' => $attributes['personnel']['badge_number'],
                    'rank_position' => $attributes['personnel']['rank_position'],
                ]);
            }

            return $user;
        });

        return $this->success('User account created', ['user' => $this->userRow($user->getKey())], 201);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        abort_unless($request->user() && $request->user()->role === 'admin', 403, 'Admin access required.');
        abort_if((string) $user->getKey() === (string) $request->user()->getAuthIdentifier(), 403, 'You cannot modify your own administrator account here.');
        abort_if($user->role === 'admin', 403, 'System administrator accounts cannot be changed here.');

        $personnel = DB::table('bfp_personnel')->where('user_id', $user->getKey())->first();
        $attributes = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'contact_number' => ['sometimes', 'required', 'string', 'max:20'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->getKey(), $user->getKeyName())],
            'role' => ['sometimes', Rule::in([User::ROLE_RESIDENT, User::ROLE_BFP])],
            'personnel.badge_number' => [
                Rule::requiredIf($request->input('role', $user->role) === User::ROLE_BFP && ! $personnel),
                'nullable',
                'string',
                'max:50',
                Rule::unique('bfp_personnel', 'badge_number')->ignore($personnel?->personnel_id, 'personnel_id'),
            ],
            'personnel.rank_position' => [
                Rule::requiredIf($request->input('role', $user->role) === User::ROLE_BFP && ! $personnel),
                'nullable',
                'string',
                'max:100',
            ],
        ]);

        $newRole = $attributes['role'] ?? $user->role;
        if ($personnel && $newRole !== User::ROLE_BFP) {
            $inUse = DB::table('response_dispatches')->where('personnel_id', $personnel->personnel_id)->exists()
                || DB::table('incident_records')->where('personnel_id', $personnel->personnel_id)->exists();
            if ($inUse) {
                return $this->error('This personnel account is referenced by dispatch or incident records and cannot be changed to a resident.', 409);
            }
        }

        DB::transaction(function () use ($user, $attributes, $personnel, $newRole): void {
            $user->fill(array_intersect_key($attributes, array_flip(['name', 'contact_number', 'email'])));
            if (array_key_exists('role', $attributes)) {
                $user->role = $newRole;
            }
            $user->save();

            if ($personnel && $newRole !== User::ROLE_BFP) {
                DB::table('bfp_personnel')->where('personnel_id', $personnel->personnel_id)->delete();
            } elseif ($newRole === User::ROLE_BFP && isset($attributes['personnel'])) {
                DB::table('bfp_personnel')->updateOrInsert(
                    ['user_id' => $user->getKey()],
                    [
                        'badge_number' => $attributes['personnel']['badge_number'],
                        'rank_position' => $attributes['personnel']['rank_position'],
                    ],
                );
            }
        });

        return $this->ok('User account updated', ['user' => $this->userRow($user->getKey())]);
    }

    public function destroyUser(Request $request, User $user): JsonResponse
    {
        abort_unless($request->user() && $request->user()->role === 'admin', 403, 'Admin access required.');
        abort_if((string) $user->getKey() === (string) $request->user()->getAuthIdentifier(), 403, 'You cannot delete your own administrator account.');
        abort_if($user->role === 'admin', 403, 'System administrator accounts cannot be deleted here.');

        if ($user->reports()->exists()) {
            return $this->error('This user has incident reports and cannot be deleted.', 409);
        }

        $personnel = DB::table('bfp_personnel')->where('user_id', $user->getKey())->first();
        if ($personnel && (
            DB::table('response_dispatches')->where('personnel_id', $personnel->personnel_id)->exists()
            || DB::table('incident_records')->where('personnel_id', $personnel->personnel_id)->exists()
        )) {
            return $this->error('This personnel account is referenced by dispatch or incident records and cannot be deleted.', 409);
        }

        DB::transaction(function () use ($user, $personnel): void {
            if ($personnel) {
                DB::table('bfp_personnel')->where('personnel_id', $personnel->personnel_id)->delete();
            }
            $user->delete();
        });

        return $this->ok('User account deleted');
    }

    public function storeFiretruck(Request $request): JsonResponse
    {
        abort_unless($request->user() && $request->user()->role === 'admin', 403, 'Admin access required.');
        $attributes = $request->validate([
            'unit_name' => ['required', 'string', 'max:100'],
            'plate_number' => ['required', 'string', 'max:50', 'unique:firetrucks,plate_number'],
            'status' => ['required', 'string', 'max:50'],
        ]);
        $truckId = DB::table('firetrucks')->insertGetId($attributes, 'truck_id');

        return $this->success('Firetruck created', ['firetruck' => $this->firetruckRow($truckId)], 201);
    }

    public function updateFiretruck(Request $request, int $truckId): JsonResponse
    {
        abort_unless($request->user() && $request->user()->role === 'admin', 403, 'Admin access required.');
        abort_unless(DB::table('firetrucks')->where('truck_id', $truckId)->exists(), 404);
        $attributes = $request->validate([
            'unit_name' => ['sometimes', 'required', 'string', 'max:100'],
            'plate_number' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('firetrucks', 'plate_number')->ignore($truckId, 'truck_id')],
            'status' => ['sometimes', 'required', 'string', 'max:50'],
        ]);
        DB::table('firetrucks')->where('truck_id', $truckId)->update($attributes);

        return $this->ok('Firetruck updated', ['firetruck' => $this->firetruckRow($truckId)]);
    }

    public function destroyFiretruck(Request $request, int $truckId): JsonResponse
    {
        abort_unless($request->user() && $request->user()->role === 'admin', 403, 'Admin access required.');
        abort_unless(DB::table('firetrucks')->where('truck_id', $truckId)->exists(), 404);
        if (DB::table('response_dispatches')->where('truck_id', $truckId)->exists()) {
            return $this->error('This firetruck is referenced by dispatch records and cannot be deleted.', 409);
        }
        DB::table('firetrucks')->where('truck_id', $truckId)->delete();

        return $this->ok('Firetruck deleted');
    }

    public function barangayRiskReferences(Request $request): JsonResponse
    {
        abort_unless($request->user() && $request->user()->role === 'admin', 403, 'Admin access required.');
        $rows = BarangayRiskReference::query()->orderBy('barangay_name')->get();

        return $this->ok('Barangay risk references retrieved', ['barangays' => $rows]);
    }

    public function updateBarangayRiskReference(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user() && $request->user()->role === 'admin', 403, 'Admin access required.');
        $ref = BarangayRiskReference::query()->findOrFail($id);
        $data = $request->validate([
            'reference_risk_level' => ['required', 'in:High,Moderate,Low'],
            'risk_description' => ['nullable', 'string', 'max:2000'],
            'data_source' => ['nullable', 'string', 'max:255'],
            'verification_status' => ['nullable', 'string', 'max:80'],
        ]);
        $data['reference_last_updated_at'] = now();
        $ref->update($data);

        return $this->ok('Barangay risk reference updated', ['barangay' => $ref->fresh()]);
    }

    private function users()
    {
        return DB::table('users')
            ->leftJoin('roles', 'roles.role_id', '=', 'users.role_id')
            ->leftJoin('bfp_personnel as personnel', 'personnel.user_id', '=', 'users.user_id')
            ->orderBy('users.full_name')
            ->get([
                'users.user_id',
                'users.full_name',
                'users.contact_number',
                'users.email',
                'roles.role_name',
                'personnel.personnel_id',
                'personnel.badge_number',
                'personnel.rank_position',
            ]);
    }

    private function userRow(int|string $userId): object
    {
        return $this->users()->firstWhere('user_id', $userId);
    }

    private function firetruckRow(int|string $truckId): object
    {
        return DB::table('firetrucks as trucks')
            ->where('trucks.truck_id', $truckId)
            ->first([
                'trucks.truck_id',
                'trucks.unit_name',
                'trucks.plate_number',
                'trucks.status',
            ]);
    }

    /**
     * @return array{areas:int,high:int,model_available:bool,generated_at:string,reference:array}
     */
    private function highRiskSummary(): array
    {
        $analysis = $this->buildHighRiskAnalysis('365');
        $ref = BarangayRiskReference::query()->orderBy('barangay_name')->get();
        $refHigh = $ref->where('reference_risk_level', 'High')->count();
        $refModerate = $ref->where('reference_risk_level', 'Moderate')->count();

        $high = 0;
        foreach (($analysis['historical_areas'] ?? []) as $area) {
            if (($area['risk_level'] ?? null) === 'High') {
                $high++;
            }
        }

        return [
            'areas' => count($analysis['historical_areas'] ?? []),
            'high' => $high,
            'model_available' => $analysis['model_available'],
            'generated_at' => $analysis['generated_at'],
            'period_days' => $analysis['period_days'],
            'reference' => [
                'total' => $ref->count(),
                'high' => $refHigh,
                'moderate' => $refModerate,
            ],
        ];
    }

    private function normalizeRiskPeriod(mixed $period): string
    {
        $value = (string) $period;

        return in_array($value, ['30', '90', '365', 'all'], true) ? $value : '365';
    }

    private function normalizeBarangayKey(string $name): string
    {
        $n = preg_replace('/\s+/', ' ', trim($name)) ?? trim($name);

        return mb_strtolower($n);
    }

    /**
     * Builds explainable high-risk analysis: 6 reference barangays + historical incident stats matched by name.
     *
     * @return array<string, mixed>
     */
    private function buildHighRiskAnalysis(string $period = '365'): array
    {
        $rows = $this->incidentRowsForAnalysis();
        $periodDays = $period === 'all' ? null : (int) $period;
        $cutoff = $periodDays ? now()->copy()->subDays($periodDays) : null;

        if ($cutoff) {
            $rows = array_values(array_filter($rows, function (object $row) use ($cutoff): bool {
                if (empty($row->reported_at)) {
                    return true;
                }

                try {
                    return \Illuminate\Support\Carbon::parse($row->reported_at)->gte($cutoff);
                } catch (\Throwable) {
                    return true;
                }
            }));
        }

        $referenceBarangays = BarangayRiskReference::query()
            ->orderBy('reference_risk_level')
            ->orderBy('barangay_name')
            ->get()
            ->map(fn ($b) => [
                'barangay_name' => $b->barangay_name,
                'latitude' => (float) $b->latitude,
                'longitude' => (float) $b->longitude,
                'reference_risk_level' => $b->reference_risk_level,
                'risk_description' => $b->risk_description,
                'data_source' => $b->data_source,
                'verification_status' => $b->verification_status,
                'reference_last_updated_at' => $b->reference_last_updated_at?->toIso8601String(),
            ])
            ->all();

        $historicalAreas = [];
        if ($rows !== []) {
            $groups = [];
            foreach ($rows as $row) {
                $key = $this->riskAreaKey($row);
                if (! isset($groups[$key])) {
                    $groups[$key] = [
                        'area' => $key,
                        'incident_count' => 0,
                        'recent_count' => 0,
                        'severity_score' => 0.0,
                        'last_reported_at' => null,
                        'lat_sum' => 0.0,
                        'lng_sum' => 0.0,
                        'coord_count' => 0,
                        'sample_address' => null,
                    ];
                }

                $groups[$key]['incident_count']++;

                $severity = strtolower((string) ($row->fire_severity ?? ''));
                $groups[$key]['severity_score'] += match ($severity) {
                    'large' => 3.0,
                    'medium' => 2.0,
                    'small' => 1.0,
                    default => 1.5,
                };

                $reportedAt = $row->reported_at ? \Illuminate\Support\Carbon::parse($row->reported_at) : null;
                if ($reportedAt) {
                    $days = $reportedAt->diffInDays(now());
                    if ($days <= 30) {
                        $groups[$key]['recent_count'] += 2;
                    } elseif ($days <= 90) {
                        $groups[$key]['recent_count'] += 1;
                    }

                    if ($groups[$key]['last_reported_at'] === null
                        || $reportedAt->gt(\Illuminate\Support\Carbon::parse($groups[$key]['last_reported_at']))) {
                        $groups[$key]['last_reported_at'] = $reportedAt->toIso8601String();
                    }
                }

                if (is_numeric($row->latitude) && is_numeric($row->longitude)) {
                    $groups[$key]['lat_sum'] += (float) $row->latitude;
                    $groups[$key]['lng_sum'] += (float) $row->longitude;
                    $groups[$key]['coord_count']++;
                }

                if ($groups[$key]['sample_address'] === null && ! empty($row->address)) {
                    $groups[$key]['sample_address'] = $row->address;
                }
            }

            foreach ($groups as $group) {
                $count = $group['incident_count'];
                $avgSeverity = $count > 0 ? $group['severity_score'] / $count : 0.0;
                $score = ($count * 12) + ($group['recent_count'] * 8) + ($avgSeverity * 6);
                $score = (int) round(min(100, $score));

                $riskLevel = match (true) {
                    $score >= 45 || $count >= 3 => 'High',
                    $score >= 22 || $count >= 2 => 'Moderate',
                    default => 'Low',
                };

                $latitude = $group['coord_count'] > 0 ? round($group['lat_sum'] / $group['coord_count'], 7) : null;
                $longitude = $group['coord_count'] > 0 ? round($group['lng_sum'] / $group['coord_count'], 7) : null;

                $historicalAreas[] = [
                    'area' => $group['area'],
                    'address' => $group['sample_address'],
                    'risk_level' => $riskLevel,
                    'risk_score' => $score,
                    'incident_count' => $count,
                    'average_severity' => round($avgSeverity, 2),
                    'last_reported_at' => $group['last_reported_at'],
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                    'factors' => [
                        'frequency' => $count,
                        'recent_activity' => $group['recent_count'],
                        'severity_weight' => round($avgSeverity, 2),
                    ],
                ];
            }

            usort($historicalAreas, function (array $a, array $b): int {
                $rank = ['High' => 3, 'Moderate' => 2, 'Low' => 1];
                $levelCmp = ($rank[$b['risk_level']] ?? 0) <=> ($rank[$a['risk_level']] ?? 0);
                if ($levelCmp !== 0) {
                    return $levelCmp;
                }

                return ($b['risk_score'] ?? 0) <=> ($a['risk_score'] ?? 0);
            });
        }

        $matchedHistoricalByRef = [];
        foreach ($referenceBarangays as $ref) {
            $refKey = $this->normalizeBarangayKey($ref['barangay_name']);
            $found = null;
            foreach ($historicalAreas as $ha) {
                $haKey = $this->normalizeBarangayKey(str_replace(['Brgy.', 'Barangay', 'Brgy'], '', $ha['area']));
                if ($haKey === $refKey || str_contains($haKey, $refKey) || str_contains($refKey, $haKey)) {
                    $found = $ha;
                    break;
                }
            }
            if ($found) {
                $matchedHistoricalByRef[$ref['barangay_name']] = [
                    'available' => true,
                    'incident_count' => $found['incident_count'],
                    'risk_level' => $found['risk_level'],
                    'risk_score' => $found['risk_score'],
                    'average_severity' => $found['average_severity'],
                    'last_reported_at' => $found['last_reported_at'],
                    'factors' => $found['factors'],
                    'matched_area_name' => $found['area'],
                ];
            } else {
                $matchedHistoricalByRef[$ref['barangay_name']] = [
                    'available' => false,
                    'incident_count' => 0,
                    'risk_level' => null,
                    'risk_score' => null,
                    'average_severity' => null,
                    'last_reported_at' => null,
                    'factors' => null,
                    'matched_area_name' => null,
                ];
            }
        }

        $periodLabel = $periodDays ? "last {$periodDays} days" : 'all recorded time';

        return [
            'model_available' => $rows !== [],
            'generated_at' => now()->toIso8601String(),
            'methodology' => "Reference: the 6 Mansalay barangays listed below use supplied initial reference classifications (not independent verification). Historical incident analysis (when available) is computed from recorded fire reports for {$periodLabel} using frequency, recent activity, and reported severity; this is analytical guidance, not an automatic dispatch trigger and not a trained/validated ML model output.",
            'seasonal_note' => 'Seasonal risk reference (not a confirmed forecast): Mansalay is generally vulnerable to grass fires during March-May because of prolonged dry conditions and grassland/rolling terrain. This does not automatically change scores unless a documented validated methodology is applied.',
            'total_incidents_analyzed' => count($rows),
            'period' => $period,
            'period_days' => $periodDays,
            'reference_barangays' => array_map(function ($ref) use ($matchedHistoricalByRef) {
                $ref['historical'] = $matchedHistoricalByRef[$ref['barangay_name']] ?? ['available' => false];
                return $ref;
            }, $referenceBarangays),
            'historical_areas' => $historicalAreas,
        ];
    }

    /**
     * @return list<object>
     */
    private function incidentRowsForAnalysis(): array
    {
        $query = DB::table('fire_reports as r');

        $addressColumn = Schema::hasColumn('fire_reports', 'landmark_address') ? 'r.landmark_address' : 'r.incident_address';
        $dateColumn = Schema::hasColumn('fire_reports', 'submitted_at') ? 'r.submitted_at' : 'r.reported_at';
        $reportKey = Schema::hasColumn('fire_reports', 'report_id') ? 'r.report_id' : 'r.id';

        $select = [
            DB::raw($reportKey.' as report_id'),
            DB::raw($addressColumn.' as address'),
            DB::raw($dateColumn.' as reported_at'),
        ];

        if (Schema::hasColumn('fire_reports', 'fire_severity')) {
            $select[] = 'r.fire_severity';
        } else {
            $select[] = DB::raw('NULL as fire_severity');
        }

        if (Schema::hasColumn('fire_reports', 'latitude') && Schema::hasColumn('fire_reports', 'longitude')) {
            $select[] = 'r.latitude';
            $select[] = 'r.longitude';
        } elseif (Schema::hasTable('report_locations')) {
            $locationKey = Schema::hasColumn('report_locations', 'report_id') ? 'l.report_id' : 'l.fire_report_id';
            $query->leftJoin('report_locations as l', $locationKey, '=', $reportKey);
            $select[] = 'l.latitude';
            $select[] = 'l.longitude';
            if (Schema::hasColumn('report_locations', 'barangay_name')) {
                $select[] = 'l.barangay_name';
            }
        } else {
            $select[] = DB::raw('NULL as latitude');
            $select[] = DB::raw('NULL as longitude');
        }

        return $query->orderByDesc(DB::raw($dateColumn))->get($select)->all();
    }

    private function riskAreaKey(object $row): string
    {
        $address = trim((string) ($row->address ?? ''));
        if ($address !== '') {
            $normalized = preg_replace('/\s+/', ' ', $address) ?? $address;

            if (preg_match('/\b(?:brgys?\.?|barangays?|bgry\.?|bgy\.?|bry\.?)\s*([^,]+)/iu', $normalized, $matches)) {
                $name = $this->normalizeAreaLabel($matches[1]);
                if ($name !== '') {
                    return 'Brgy. '.$name;
                }
            }

            $parts = array_values(array_filter(array_map('trim', explode(',', $normalized))));
            foreach (array_reverse($parts) as $part) {
                if ($part === '' || stripos($part, 'mansalay') !== false || stripos($part, 'oriental mindoro') !== false) {
                    continue;
                }
                if (preg_match('/^(current device location)$/i', $part)) {
                    continue;
                }

                return $this->normalizeAreaLabel($part);
            }

            return $this->normalizeAreaLabel($parts[0] ?? $normalized);
        }

        if (is_numeric($row->latitude ?? null) && is_numeric($row->longitude ?? null)) {
            return 'Vicinity '.round((float) $row->latitude, 3).', '.round((float) $row->longitude, 3);
        }

        return 'Unknown location';
    }

    private function normalizeAreaLabel(string $value): string
    {
        $value = preg_replace('/\s+/', ' ', trim($value)) ?? trim($value);

        return $value !== '' ? $value : 'Unknown location';
    }
}
