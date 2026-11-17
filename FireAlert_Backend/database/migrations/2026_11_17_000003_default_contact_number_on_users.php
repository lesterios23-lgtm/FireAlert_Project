<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The manager user endpoints (/api/v1/users) do not collect a contact number,
 * but the column was created NOT NULL without a default, so creating or
 * replacing an account through that API failed with a database error. An empty
 * string is a valid "not provided" value here (Google sign-up already stores
 * '').
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        if (Schema::hasColumn('users', 'contact_number')) {
            DB::statement("ALTER TABLE `users` MODIFY `contact_number` VARCHAR(20) NOT NULL DEFAULT ''");
        }
    }

    public function down(): void
    {
        // Keeping the default is harmless; reverting could fail on empty rows.
    }
};
