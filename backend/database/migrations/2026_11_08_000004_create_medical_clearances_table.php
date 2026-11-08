<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Nurse portal → Documents → Medical Clearance: one certification for a whole batch of students
 * (for example a section joining an off-campus activity). The names are typed by the nurse, since
 * there is no master list yet, so they are kept as a list on the clearance, not linked to accounts.
 */
return new class extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('medical_clearances')) {
            Schema::create('medical_clearances', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('activity');
                $table->string('venue');
                $table->string('group_label', 100)->nullable();
                $table->date('activity_date');
                $table->date('certified_date');
                $table->json('students');
                $table->foreignUuid('issued_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->softDeletes();
                $table->index('certified_date');
            });
        }
    }

    public function down()
    {
        Schema::dropIfExists('medical_clearances');
    }
};
