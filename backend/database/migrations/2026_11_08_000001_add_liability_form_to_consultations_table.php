<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Consultation → "Release Documents" → Medical Liability Form (optional). The student declares they
 * are fit to join an activity; the form prints with the activity's name and is listed on the
 * student's Health Records → Medical Liability tab.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->boolean('liability_form')->default(false)->after('medical_certificate_ref');
            $table->string('liability_activity')->nullable()->after('liability_form');
        });
    }

    public function down(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->dropColumn(['liability_form', 'liability_activity']);
        });
    }
};
