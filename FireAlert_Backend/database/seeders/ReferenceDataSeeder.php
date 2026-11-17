<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

/**
 * Reference data every deployment needs: account roles and the report status
 * lookup table. Safe to run repeatedly (idempotent) and safe to run in
 * production.
 *
 * An initial administrator can be created from the environment:
 *   FIREALERT_ADMIN_EMAIL, FIREALERT_ADMIN_PASSWORD,
 *   FIREALERT_ADMIN_NAME (optional), FIREALERT_ADMIN_CONTACT (optional)
 * It only runs when the credentials are present and no administrator exists.
 */
class ReferenceDataSeeder extends Seeder
{
    public function run(): void
    {
        if (Schema::hasTable('roles')) {
            $roles = [
                ['role_id' => 1, 'role_name' => 'Resident', 'description' => 'General community user capable of submitting fire emergency reports'],
                ['role_id' => 2, 'role_name' => 'BFP Staff', 'description' => 'Authorized fire station personnel managing dispatch and incidents'],
                ['role_id' => 3, 'role_name' => 'System Admin', 'description' => 'System administrator managing user accounts and system configurations'],
            ];

            foreach ($roles as $role) {
                DB::table('roles')->updateOrInsert(
                    ['role_id' => $role['role_id']],
                    $role,
                );
            }
        }

        if (Schema::hasTable('response_statuses')) {
            $statuses = [
                ['status_id' => 1, 'status_name' => 'Submitted', 'description' => 'Emergency report submitted by resident'],
                ['status_id' => 2, 'status_name' => 'Received', 'description' => 'Emergency report acknowledged by BFP personnel'],
                ['status_id' => 3, 'status_name' => 'Dispatched', 'description' => 'Firetruck and response team dispatched to incident location'],
                ['status_id' => 4, 'status_name' => 'En Route', 'description' => 'Responders active on route to reported location'],
                ['status_id' => 5, 'status_name' => 'Arrived', 'description' => 'Responders arrived on scene'],
                ['status_id' => 6, 'status_name' => 'Resolved', 'description' => 'Emergency situation resolved and documented'],
            ];

            foreach ($statuses as $status) {
                DB::table('response_statuses')->updateOrInsert(
                    ['status_id' => $status['status_id']],
                    $status,
                );
            }
        }

        $this->createFirstAdministrator();
    }

    private function createFirstAdministrator(): void
    {
        $email = trim((string) config('firealert.admin.email', ''));
        $password = (string) config('firealert.admin.password', '');

        if ($email === '' || $password === '') {
            return;
        }

        $alreadyHasAdmin = DB::table('users')
            ->where(function ($query): void {
                if (Schema::hasColumn('users', 'role_id') && Schema::hasTable('roles')) {
                    $adminRoleId = DB::table('roles')
                        ->whereRaw('LOWER(role_name) = ?', ['system admin'])
                        ->value('role_id');

                    if ($adminRoleId !== null) {
                        $query->where('role_id', $adminRoleId);

                        return;
                    }
                }

                $query->where('role', 'admin');
            })
            ->exists();

        if ($alreadyHasAdmin) {
            return;
        }

        User::create([
            'name' => config('firealert.admin.name', 'System Administrator'),
            'contact_number' => config('firealert.admin.contact', ''),
            'email' => $email,
            'password' => Hash::make($password),
            'role' => 'admin',
        ]);
    }
}
