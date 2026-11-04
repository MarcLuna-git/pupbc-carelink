<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// How long the student has had the symptoms, asked at the kiosk for General Consultation.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('triage_assessments', function (Blueprint $table) {
            $table->string('symptom_duration', 30)->nullable()->after('chief_complaint');
        });
    }

    public function down(): void
    {
        Schema::table('triage_assessments', function (Blueprint $table) {
            $table->dropColumn('symptom_duration');
        });
    }
};
