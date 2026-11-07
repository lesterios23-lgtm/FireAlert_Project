<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'address')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('address', 500)->nullable()->after('contact_number');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'address')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('address');
            });
        }
    }
};

