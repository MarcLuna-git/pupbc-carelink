<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('triage_assessments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('appointment_checkin_id')->unique()->constrained('appointment_checkins')->onDelete('cascade');
            $table->text('chief_complaint')->nullable();
            $table->string('severity', 20)->default('mild');
            $table->json('red_flags')->nullable();
            $table->string('priority', 20)->default('LOW');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index('priority');
        });

        Schema::create('emergency_encounters', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignUuid('recorded_by')->constrained('users')->onDelete('restrict');
            $table->dateTime('incident_datetime');
            $table->text('reason');
            $table->text('symptoms')->nullable();
            $table->text('assessment')->nullable();
            $table->text('intervention')->nullable();
            $table->string('disposition')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'incident_datetime']);
        });

        Schema::table('consultations', function (Blueprint $table) {
            $table->foreignUuid('appointment_checkin_id')->nullable()->after('appointment_id')
                ->constrained('appointment_checkins')->onDelete('set null');
        });
    }

    public function down()
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->dropForeign(['appointment_checkin_id']);
            $table->dropColumn('appointment_checkin_id');
        });
        Schema::dropIfExists('emergency_encounters');
        Schema::dropIfExists('triage_assessments');
    }
};
