<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('firetrucks') || ! Schema::hasColumn('firetrucks', 'station_id')) {
            return;
        }

        Schema::table('firetrucks', function (Blueprint $table): void {
            $table->integer('station_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('firetrucks') || ! Schema::hasColumn('firetrucks', 'station_id')) {
            return;
        }

        if (DB::table('firetrucks')->whereNull('station_id')->exists()) {
            throw new RuntimeException('Cannot require a station while firetrucks have no assigned station.');
        }

        Schema::table('firetrucks', function (Blueprint $table): void {
            $table->integer('station_id')->nullable(false)->change();
        });
    }
};
