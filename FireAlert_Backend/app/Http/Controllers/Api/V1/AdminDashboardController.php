<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Resources\V1\FireReportResource;
use App\Models\FireReport;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class AdminDashboardController extends APIController
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $reports = FireReport::query()
            ->with('resident')
            ->orderByDesc(FireReport::columnFor('reportedAt'))
            ->get()
            ->map(fn (FireReport $report): array => (new FireReportResource($report))->resolve($request));

        return $this->ok('System administrator data retrieved', [
            'reports' => $reports,
            'users' => $this->users(),
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

    public function storeUser(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
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
        $this->authorizeAdmin($request);
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
        $this->authorizeAdmin($request);
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
        $this->authorizeAdmin($request);
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
        $this->authorizeAdmin($request);
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
        $this->authorizeAdmin($request);
        abort_unless(DB::table('firetrucks')->where('truck_id', $truckId)->exists(), 404);
        if (DB::table('response_dispatches')->where('truck_id', $truckId)->exists()) {
            return $this->error('This firetruck is referenced by dispatch records and cannot be deleted.', 409);
        }
        DB::table('firetrucks')->where('truck_id', $truckId)->delete();

        return $this->ok('Firetruck deleted');
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

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, 'System administrator access is required.');
    }
}
