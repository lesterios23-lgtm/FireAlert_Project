<?php

namespace Database\Factories;

use App\Models\FireReport;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FireReport>
 */
class FireReportFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'resident_id' => User::factory(),
            'incident_description' => 'Fictional test report; not a real emergency.',
            'incident_address' => 'Fictional test location',
            'latitude' => null,
            'longitude' => null,
            'location_source' => null,
            'status' => 'pending',
            'reported_at' => now(),
        ];
    }
}
