<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The appointment_checkins table was originally created by
 * 2026_07_05_104955_create_appointment_checkins_table with a minimal
 * schema (checked_in_at / chief_complaint / checkin_status). The kiosk
 * migration 2026_07_09_132041 tried to create the full-featured table
 * but was skipped because the table already existed — so production
 * never got the queue columns the kiosk relies on. This migration adds
 * any missing columns defensively.
 */
return new class extends Migration
{
    public function up()
    {
        Schema::table('appointment_checkins', function (Blueprint $table) {
            if (!Schema::hasColumn('appointment_checkins', 'queue_number')) {
                $table->string('queue_number', 10)->nullable();
            }
            if (!Schema::hasColumn('appointment_checkins', 'queue_type')) {
                $table->string('queue_type', 20)->default('regular'); // regular | priority
            }
            if (!Schema::hasColumn('appointment_checkins', 'triage_reason')) {
                $table->string('triage_reason')->nullable();
            }
            if (!Schema::hasColumn('appointment_checkins', 'is_walk_in')) {
                $table->boolean('is_walk_in')->default(false);
            }
            if (!Schema::hasColumn('appointment_checkins', 'status')) {
                $table->string('status', 20)->default('waiting'); // waiting | serving | completed | no_show
            }
            if (!Schema::hasColumn('appointment_checkins', 'check_in_time')) {
                $table->timestamp('check_in_time')->nullable();
            }
        });
    }

    public function down()
    {
        Schema::table('appointment_checkins', function (Blueprint $table) {
            foreach (['queue_number', 'queue_type', 'triage_reason', 'is_walk_in', 'status', 'check_in_time'] as $col) {
                if (Schema::hasColumn('appointment_checkins', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
