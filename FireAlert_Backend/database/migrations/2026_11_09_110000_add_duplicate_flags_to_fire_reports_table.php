<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('fire_reports') && ! Schema::hasColumn('fire_reports', 'duplicate_flag')) {
            Schema::table('fire_reports', function (Blueprint $table) {
                $table->string('duplicate_flag', 20)->nullable()->index();
                $table->unsignedBigInteger('duplicate_of_report_id')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('fire_reports') && Schema::hasColumn('fire_reports', 'duplicate_flag')) {
            Schema::table('fire_reports', function (Blueprint $table) {
                $table->dropColumn(['duplicate_flag', 'duplicate_of_report_id']);
            });
        }
    }
};
