<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('appointment_checkins', function (Blueprint $table) {
            if (!Schema::hasColumn('appointment_checkins', 'queue_number')) {
                $table->string('queue_number', 10)->nullable();
            }
            if (!Schema::hasColumn('appointment_checkins', 'queue_type')) {
                $table->string('queue_type', 20)->default('regular');
            }
            if (!Schema::hasColumn('appointment_checkins', 'triage_reason')) {
                $table->string('triage_reason')->nullable();
            }
            if (!Schema::hasColumn('appointment_checkins', 'is_walk_in')) {
                $table->boolean('is_walk_in')->default(false);
            }
            if (!Schema::hasColumn('appointment_checkins', 'status')) {
                $table->string('status', 20)->default('waiting');
            }
            if (!Schema::hasColumn('appointment_checkins', 'check_in_time')) {
                $table->timestamp('check_in_time')->nullable();
            }
        });

        if (Schema::hasColumn('appointment_checkins', 'appointment_id')) {
            $driver = DB::connection()->getDriverName();
            if ($driver === 'pgsql') {
                DB::statement('ALTER TABLE appointment_checkins ALTER COLUMN appointment_id DROP NOT NULL');
            } elseif ($driver === 'mysql') {
                DB::statement('ALTER TABLE appointment_checkins MODIFY appointment_id CHAR(36) NULL');
            }
        }
    }

    public function down()
    {
        foreach ([
            'queue_number',
            'queue_type',
            'triage_reason',
            'is_walk_in',
            'status',
            'check_in_time',
        ] as $column) {
            if (Schema::hasColumn('appointment_checkins', $column)) {
                Schema::table('appointment_checkins', function (Blueprint $table) use ($column) {
                    $table->dropColumn($column);
                });
            }
        }
    }
};
