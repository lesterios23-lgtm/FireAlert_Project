<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The production database keeps dispatch records in a legacy
     * `response_dispatches` table. The SQLite test database builds its schema
     * from migrations instead, so create the same shape when it is missing and
     * add the live-tracking columns to either variant.
     */
    public function up(): void
    {
        if (! Schema::hasTable('response_dispatches')) {
            Schema::create('response_dispatches', function (Blueprint $table): void {
                $table->id('dispatch_id');
                $table->unsignedBigInteger('report_id')->index();
                $table->unsignedBigInteger('truck_id')->nullable()->index();
                $table->unsignedBigInteger('personnel_id')->nullable()->index();
                $table->timestamp('dispatched_at')->useCurrent();
                $table->timestamp('arrived_at')->nullable();
                $table->integer('estimated_eta_minutes')->nullable();
                $table->decimal('current_latitude', 10, 8)->nullable();
                $table->decimal('current_longitude', 11, 8)->nullable();
                $table->decimal('location_accuracy_meters', 8, 2)->nullable();
                $table->timestamp('location_updated_at')->nullable();
            });

            return;
        }

        $missing = array_values(array_filter([
            'current_latitude',
            'current_longitude',
            'location_accuracy_meters',
            'location_updated_at',
        ], static fn (string $column): bool => ! Schema::hasColumn('response_dispatches', $column)));

        if ($missing === []) {
            return;
        }

        Schema::table('response_dispatches', function (Blueprint $table) use ($missing): void {
            foreach ($missing as $column) {
                match ($column) {
                    'current_latitude' => $table->decimal('current_latitude', 10, 8)->nullable(),
                    'current_longitude' => $table->decimal('current_longitude', 11, 8)->nullable(),
                    'location_accuracy_meters' => $table->decimal('location_accuracy_meters', 8, 2)->nullable(),
                    'location_updated_at' => $table->timestamp('location_updated_at')->nullable(),
                };
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('response_dispatches')) {
            return;
        }

        $columns = array_values(array_filter([
            'current_latitude',
            'current_longitude',
            'location_accuracy_meters',
            'location_updated_at',
        ], static fn (string $column): bool => Schema::hasColumn('response_dispatches', $column)));

        if ($columns === []) {
            return;
        }

        Schema::table('response_dispatches', function (Blueprint $table) use ($columns): void {
            $table->dropColumn($columns);
        });
    }
};
