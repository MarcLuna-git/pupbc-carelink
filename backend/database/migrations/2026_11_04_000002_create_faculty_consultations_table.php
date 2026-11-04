<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // A clinic consultation for a faculty member (they are nurse-kept records, not accounts).
        if (!Schema::hasTable('faculty_consultations')) {
            Schema::create('faculty_consultations', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('faculty_member_id')->constrained('faculty_members')->cascadeOnDelete();
                $table->string('chief_complaint', 500);
                $table->string('blood_pressure', 20)->nullable();
                $table->decimal('temperature', 4, 1)->nullable();
                $table->unsignedSmallInteger('pulse_rate')->nullable();
                $table->text('assessment')->nullable();
                $table->text('intervention')->nullable();
                $table->text('notes')->nullable();
                $table->foreignUuid('consulted_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->index(['faculty_member_id', 'created_at']);
            });
        }
    }

    public function down()
    {
        Schema::dropIfExists('faculty_consultations');
    }
};
