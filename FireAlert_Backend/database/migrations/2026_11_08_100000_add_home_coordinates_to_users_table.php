<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'home_latitude')) {
                $table->decimal('home_latitude', 10, 7)->nullable()->after('address');
            }
            if (! Schema::hasColumn('users', 'home_longitude')) {
                $table->decimal('home_longitude', 11, 7)->nullable()->after('home_latitude');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'home_longitude')) {
                $table->dropColumn('home_longitude');
            }
            if (Schema::hasColumn('users', 'home_latitude')) {
                $table->dropColumn('home_latitude');
            }
        });
    }
};
