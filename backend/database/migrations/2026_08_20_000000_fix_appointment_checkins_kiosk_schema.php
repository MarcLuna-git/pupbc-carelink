<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // The appointment_checkins table was originally created with the OLD schema
        // (checked_in_at, chief_complaint, checkin_status) by migration
        // 2026_07_05_104955, and the kiosk update migration skipped because
        // the table already existed. We need to ALTER it to match the kiosk schema.
        Schema::table('appointment_checkins', function (Blueprint $table) {
            // Add kiosk columns if they don't exist
            if (!Schema::hasColumn('appointment_checkins', 'queue_number')) {
                $table->string('queue_number', 10)->nullable()->after('user_id');
            }
            if (!Schema::hasColumn('appointment_checkins', 'queue_type')) {
                $table->enum('queue_type', ['regular', 'priority'])->default('regular')->after('queue_number');
            }
            if (!Schema::hasColumn('appointment_checkins', 'triage_reason')) {
                $table->string('triage_reason')->nullable()->after('queue_type');
            }
            if (!Schema::hasColumn('appointment_checkins', 'is_walk_in')) {
                $table->boolean('is_walk_in')->default(false)->after('triage_reason');
            }
            if (!Schema::hasColumn('appointment_checkins', 'status')) {
                $table->string('status')->default('waiting')->after('is_walk_in');
            }
            if (!Schema::hasColumn('appointment_checkins', 'check_in_time')) {
                $table->timestamp('check_in_time')->nullable()->after('status');
            }
            // Make appointment_id nullable (walk-in patients have no appointment)
            // Use raw SQL since changing columns requires Doctrine DBAL
            if (Schema::hasColumn('appointment_checkins', 'appointment_id')) {
                if (DB::connection()->getDriverName() === 'pgsql') {
                    DB::statement('ALTER TABLE appointment_checkins ALTER COLUMN appointment_id DROP NOT NULL');
                } else {
                    DB::statement('ALTER TABLE appointment_checkins MODIFY appointment_id CHAR(36) NULL');
                }
            }
            // Make old columns nullable too so kiosk checkin works without them
            if (Schema::hasColumn('appointment_checkins', 'checked_in_at')) {
                if (DB::connection()->getDriverName() === 'pgsql') {
                    DB::statement('ALTER TABLE appointment_checkins ALTER COLUMN checked_in_at DROP NOT NULL');
                } else {
                    DB::statement('ALTER TABLE appointment_checkins MODIFY checked_in_at TIMESTAMP NULL');
                }
            }
            if (Schema::hasColumn('appointment_checkins', 'checkin_status')) {
                if (DB::connection()->getDriverName() === 'pgsql') {
                    DB::statement('ALTER TABLE appointment_checkins ALTER COLUMN checkin_status DROP NOT NULL');
                    DB::statement('ALTER TABLE appointment_checkins ALTER COLUMN checkin_status DROP DEFAULT');
                } else {
                    DB::statement("ALTER TABLE appointment_checkins MODIFY checkin_status ENUM('confirmed','no_show') NULL DEFAULT NULL");
                }
            }
        });
    }

    public function down()
    {
        Schema::table('appointment_checkins', function (Blueprint $table) {
            $columns = ['queue_number', 'queue_type', 'triage_reason', 'is_walk_in', 'status', 'check_in_time'];
            foreach ($columns as $col) {
                if (Schema::hasColumn('appointment_checkins', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};