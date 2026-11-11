<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Official incident groups. One row per real-world fire; individual
        // resident submissions in fire_reports point at it (nullable, so
        // existing rows are untouched and no history is rewritten).
        if (! Schema::hasTable('fire_incidents')) {
            Schema::create('fire_incidents', function (Blueprint $table) {
                $table->id();
                $table->string('code', 20)->unique();
                $table->text('incident_description')->nullable();
                $table->string('incident_address')->nullable();
                $table->decimal('latitude', 10, 7)->nullable();
                $table->decimal('longitude', 11, 7)->nullable();
                $table->string('status', 20)->default('pending')->index();
                $table->timestamp('first_reported_at')->nullable()->index();
                $table->timestamp('last_reported_at')->nullable();
                $table->timestamps();
            });
        }

        if (Schema::hasTable('fire_reports') && ! Schema::hasColumn('fire_reports', 'fire_incident_id')) {
            Schema::table('fire_reports', function (Blueprint $table) {
                // Legacy production schema uses `report_id` + `user_id` (no
                // `resident_id`), so add the nullable grouping column without
                // `after()` positioning or a hard FK that would block the
                // migration on old data.
                $table->unsignedBigInteger('fire_incident_id')->nullable()->index();
            });
            try {
                Schema::table('fire_reports', function (Blueprint $table) {
                    $table->foreign('fire_incident_id')
                        ->references('id')
                        ->on('fire_incidents')
                        ->nullOnDelete();
                });
            } catch (\Throwable) {
                // Best effort: grouping still works without the FK constraint.
            }
        }

        // Audit trail of every manual/auto consolidation and separation action.
        // Plain integer columns (no hard FKs): production runs a legacy schema
        // where users.fire_reports use custom keys (user_id/report_id).
        if (! Schema::hasTable('fire_incident_actions')) {
            Schema::create('fire_incident_actions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('fire_incident_id')->nullable()->index();
                $table->unsignedBigInteger('fire_report_id')->nullable()->index();
                $table->unsignedBigInteger('actor_id')->nullable()->index();
                $table->string('action', 40);
                $table->text('reason')->nullable();
                $table->json('meta')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('fire_incident_actions')) {
            Schema::dropIfExists('fire_incident_actions');
        }

        if (Schema::hasTable('fire_reports') && Schema::hasColumn('fire_reports', 'fire_incident_id')) {
            try {
                Schema::table('fire_reports', function (Blueprint $table) {
                    $table->dropForeign(['fire_incident_id']);
                });
            } catch (\Throwable) {
                // FK may not exist on legacy installs; dropping the column is enough.
            }
            Schema::table('fire_reports', function (Blueprint $table) {
                $table->dropColumn('fire_incident_id');
            });
        }

        if (Schema::hasTable('fire_incidents')) {
            Schema::dropIfExists('fire_incidents');
        }
    }
};
