<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Brings the production schema in line with what the application code reads
 * and writes. The original migrations describe an older account/report model,
 * so these columns are added defensively: every step checks first and is safe
 * to run on a schema that already has the column or table.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'is_manager')) {
                $table->boolean('is_manager')->default(false);
            }

            if (! Schema::hasColumn('users', 'home_latitude')) {
                $table->decimal('home_latitude', 10, 7)->nullable();
            }

            if (! Schema::hasColumn('users', 'home_longitude')) {
                $table->decimal('home_longitude', 11, 7)->nullable();
            }
        });

        if (! Schema::hasTable('system_settings')) {
            Schema::create('system_settings', function (Blueprint $table): void {
                $table->string('setting_key')->primary();
                $table->string('setting_value');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (Schema::hasColumn('users', 'home_longitude')) {
                $table->dropColumn('home_longitude');
            }

            if (Schema::hasColumn('users', 'home_latitude')) {
                $table->dropColumn('home_latitude');
            }

            if (Schema::hasColumn('users', 'is_manager')) {
                $table->dropColumn('is_manager');
            }
        });

        Schema::dropIfExists('system_settings');
    }
};
