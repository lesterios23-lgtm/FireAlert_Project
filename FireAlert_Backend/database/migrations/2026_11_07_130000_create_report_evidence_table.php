<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('report_evidence')) {
            Schema::create('report_evidence', function (Blueprint $table) {
                $table->id('evidence_id');
                if (Schema::hasColumn('fire_reports', 'report_id')) {
                    $table->integer('report_id');
                    $referencedKey = 'report_id';
                } else {
                    $table->foreignId('report_id');
                    $referencedKey = 'id';
                }
                $table->string('storage_path');
                $table->string('original_name');
                $table->string('mime_type', 100);
                $table->unsignedInteger('file_size');
                $table->timestamp('uploaded_at')->useCurrent();
                $table->foreign('report_id')
                    ->references($referencedKey)
                    ->on('fire_reports')
                    ->cascadeOnDelete();
                $table->index('report_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('report_evidence');
    }
};
