<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // "Rate your pain" at the kiosk: 0 (no pain) to 10 (worst pain). Nullable so
        // existing rows and older kiosk screens, which do not send it, stay valid.
        if (!Schema::hasColumn('triage_assessments', 'pain_level')) {
            Schema::table('triage_assessments', function (Blueprint $table) {
                $table->unsignedTinyInteger('pain_level')->nullable()->after('severity');
            });
        }
    }

    public function down()
    {
        if (Schema::hasColumn('triage_assessments', 'pain_level')) {
            Schema::table('triage_assessments', function (Blueprint $table) {
                $table->dropColumn('pain_level');
            });
        }
    }
};
