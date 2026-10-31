<?php

use App\Models\FireReport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

test('fire report factory creates a fictional report linked to a resident', function () {
    $report = FireReport::factory()->create();

    expect($report->resident)
        ->toBeInstanceOf(User::class)
        ->and($report->status)->toBe('pending')
        ->and($report->incident_description)->toContain('Fictional')
        ->and($report->latitude)->toBeNull()
        ->and($report->longitude)->toBeNull();
});

test('fire report schema keeps unconfirmed details and location optional', function () {
    expect(Schema::hasColumns('fire_reports', [
        'resident_id',
        'incident_description',
        'incident_address',
        'latitude',
        'longitude',
        'location_source',
        'status',
        'reported_at',
    ]))->toBeTrue();

    expect(Schema::getColumnType('fire_reports', 'incident_description'))
        ->toBe('text')
        ->and(Schema::getColumnType('fire_reports', 'latitude'))
        ->toBe('numeric');
});

test('fire report seeder creates fictional reports only in the isolated test database', function () {
    $this->seed();

    expect(FireReport::count())->toBe(100)
        ->and(User::count())->toBe(11)
        ->and(FireReport::query()->where('incident_description', 'not like', '%Fictional%')->count())
        ->toBe(0);
});
