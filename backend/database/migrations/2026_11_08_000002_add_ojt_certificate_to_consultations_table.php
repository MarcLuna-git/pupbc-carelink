<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Consultation → "Additional Documents" → Medical Certificate (OJT) (optional). A certificate that the
 * student is essentially normal and may undergo On the Job Training at a company; it prints with the
 * company's name and is listed on the student's Health Records → Medical Cert (OJT) tab.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->boolean('ojt_certificate')->default(false)->after('liability_activity');
            $table->string('ojt_certificate_ref')->nullable()->after('ojt_certificate');
            $table->string('ojt_company')->nullable()->after('ojt_certificate_ref');
        });
    }

    public function down(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->dropColumn(['ojt_certificate', 'ojt_certificate_ref', 'ojt_company']);
        });
    }
};
