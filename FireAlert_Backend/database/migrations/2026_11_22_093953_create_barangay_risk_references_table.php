<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('barangay_risk_references', function (Blueprint $table) {
            $table->id();
            $table->string('barangay_name', 120)->unique();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->string('reference_risk_level', 20); // High | Moderate (Low only if later data supports)
            $table->text('risk_description')->nullable();
            $table->string('data_source', 255)->nullable();
            $table->string('verification_status', 80)->default('Supplied initial reference');
            $table->timestamp('reference_last_updated_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('barangay_risk_references');
    }
};
