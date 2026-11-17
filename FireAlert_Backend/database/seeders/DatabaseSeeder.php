<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Roles and report statuses are required on every environment.
        $this->call(ReferenceDataSeeder::class);

        // Demo reports only belong in the isolated SQLite testing environment.
        if (app()->environment('testing') && config('database.default') === 'sqlite') {
            $this->call(FireReportSeeder::class);
        }
    }
}
