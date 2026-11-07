<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('firetrucks') && Schema::hasColumn('firetrucks', 'station_id')) {
            Schema::table('firetrucks', function (Blueprint $table): void {
                $table->dropForeign('firetrucks_ibfk_1');
                $table->dropColumn('station_id');
            });
        }

        if (Schema::hasTable('bfp_personnel') && Schema::hasColumn('bfp_personnel', 'station_id')) {
            Schema::table('bfp_personnel', function (Blueprint $table): void {
                $table->dropForeign('bfp_personnel_ibfk_2');
                $table->dropColumn('station_id');
            });
        }

        Schema::dropIfExists('bfp_stations');
    }

    public function down(): void
    {
        if (! Schema::hasTable('bfp_stations')) {
            Schema::create('bfp_stations', function (Blueprint $table): void {
                $table->integer('station_id')->autoIncrement();
                $table->primary('station_id');
                $table->string('station_name', 100);
                $table->string('address');
                $table->string('contact_number', 15);
                $table->decimal('latitude', 10, 8);
                $table->decimal('longitude', 11, 8);
            });
        }

        $this->restoreStationReference('firetrucks', 'truck_id', 'firetrucks_ibfk_1', true);
        $this->restoreStationReference('bfp_personnel', 'user_id', 'bfp_personnel_ibfk_2', false);
    }

    private function restoreStationReference(
        string $tableName,
        string $after,
        string $foreignKeyName,
        bool $nullable,
    ): void
    {
        if (! Schema::hasTable($tableName) || Schema::hasColumn($tableName, 'station_id')) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($after, $foreignKeyName, $nullable): void {
            $stationId = $table->integer('station_id')->after($after);
            if ($nullable) {
                $stationId->nullable();
            }
            $table->foreign('station_id', $foreignKeyName)
                ->references('station_id')
                ->on('bfp_stations')
                ->cascadeOnUpdate()
                ->restrictOnDelete();
        });
    }
};
