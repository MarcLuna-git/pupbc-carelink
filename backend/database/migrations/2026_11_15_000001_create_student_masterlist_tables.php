<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * The school's list of enrolled students, imported by the nurse from an Excel or CSV file
 * (Course Management → Masterlist). Registration can be limited to students on this list
 * (clinic_settings key "registration_requires_masterlist").
 */
return new class extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('masterlist_imports')) {
            Schema::create('masterlist_imports', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('academic_period_id')->index();
                $table->string('file_name', 255);
                $table->uuid('uploaded_by')->nullable();
                $table->unsignedInteger('added_count')->default(0);
                $table->unsignedInteger('updated_count')->default(0);
                $table->unsignedInteger('skipped_count')->default(0);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('student_masterlist')) {
            Schema::create('student_masterlist', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->uuid('academic_period_id');
                $table->string('student_id', 17);
                $table->string('full_name', 255);
                $table->string('last_name', 100);
                $table->string('first_name', 150)->nullable();
                $table->uuid('course_id')->nullable()->index();
                $table->string('course_code', 50)->nullable();
                $table->string('year_level', 20)->nullable();
                $table->string('section', 20)->nullable();
                $table->uuid('import_id')->nullable()->index();
                $table->timestamps();

                $table->unique(['academic_period_id', 'student_id'], 'student_masterlist_period_student_unique');
                $table->index('student_id');
            });
        }
    }

    public function down()
    {
        Schema::dropIfExists('student_masterlist');
        Schema::dropIfExists('masterlist_imports');
    }
};
