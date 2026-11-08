<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Consultation → "Additional Documents" → Medical Certificate (Sick) (optional). The student was examined
 * for an illness that needs medical attendance for a number of days; it prints with the complaint, the
 * impression and the days, and is listed on the student's Health Records → Medical Cert (Sick) tab.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->boolean('sick_certificate')->default(false)->after('ojt_company');
            $table->string('sick_certificate_ref')->nullable()->after('sick_certificate');
            $table->unsignedSmallInteger('sick_rest_days')->nullable()->after('sick_certificate_ref');
        });
    }

    public function down(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->dropColumn(['sick_certificate', 'sick_certificate_ref', 'sick_rest_days']);
        });
    }
};
