<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddNursingNotesToConsultationsTable extends Migration
{
    public function up()
    {
        // Consultation form sections beside the chief complaint and vital signs.
        Schema::table('consultations', function (Blueprint $table) {
            $table->text('history_present_illness')->nullable();
            $table->text('nursing_assessment')->nullable();
            $table->text('nursing_interventions')->nullable();
            $table->text('treatment_plan')->nullable();
        });
    }

    public function down()
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->dropColumn(['history_present_illness', 'nursing_assessment', 'nursing_interventions', 'treatment_plan']);
        });
    }
}
