<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('appointments', function (Blueprint $table) {
            if (!Schema::hasColumn('appointments', 'time_slot')) {
                $table->string('time_slot', 20)->nullable();
            }
            if (!Schema::hasColumn('appointments', 'queue_number')) {
                $table->string('queue_number', 10)->nullable();
            }
            if (!Schema::hasColumn('appointments', 'queue_type')) {
                $table->enum('queue_type', ['regular', 'priority'])->default('regular');
            }
            if (!Schema::hasColumn('appointments', 'checked_in_at')) {
                $table->timestamp('checked_in_at')->nullable();
            }
            if (!Schema::hasColumn('appointments', 'no_show')) {
                $table->boolean('no_show')->default(false);
            }
        });

        // Create appointment_checkins table if not exists
        if (!Schema::hasTable('appointment_checkins')) {
            Schema::create('appointment_checkins', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignUuid('appointment_id')->nullable()->constrained('appointments')->onDelete('set null');
                $table->foreignUuid('user_id')->constrained('users')->onDelete('cascade');
                $table->string('queue_number', 10);
                $table->enum('queue_type', ['regular', 'priority'])->default('regular');
                $table->string('triage_reason')->nullable();
                $table->boolean('is_walk_in')->default(false);
                $table->string('status')->default('waiting'); // waiting, serving, completed, no_show
                $table->timestamp('check_in_time')->useCurrent();
                $table->timestamps();
            });
        }
    }

    public function down()
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropColumn(['time_slot', 'queue_number', 'queue_type', 'checked_in_at', 'no_show']);
        });
    }
};