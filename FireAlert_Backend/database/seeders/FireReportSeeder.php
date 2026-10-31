<?php

namespace Database\Seeders;

use App\Models\FireReport;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class FireReportSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('testing') || config('database.default') !== 'sqlite') {
            throw new RuntimeException(
                'FireReportSeeder is restricted to the isolated SQLite testing environment.'
            );
        }

        $residents = User::factory(10)->create();

        FireReport::factory(100)
            ->recycle($residents)
            ->create();

        // A manager account used to test manager abilities
        User::create([
            'email' => 'manager@manager.com',
            'password' => Hash::make('password'),
            'name' => 'The Manager',
            'is_manager' => true,
            'role' => User::ROLE_BFP,
        ]);
    }
}
