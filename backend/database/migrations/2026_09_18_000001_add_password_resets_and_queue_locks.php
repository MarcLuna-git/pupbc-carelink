<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('password_resets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->onDelete('cascade');
            $table->string('otp_hash');
            $table->timestamp('expires_at');
            $table->boolean('is_used')->default(false);
            $table->timestamps();
            $table->index(['user_id', 'is_used']);
        });
        // A persistent mutex serializes allocation and visit lifecycle changes.
        Schema::create('clinic_queue_locks', function (Blueprint $table) {
            if (DB::connection()->getDriverName() === 'pgsql') {
                $table->bigInteger('id')->primary();
            } else {
                $table->unsignedInteger('id')->primary();
            }
        });
        DB::table('clinic_queue_locks')->insert(['id' => 1]);
        Schema::create('clinic_queue_counters', function (Blueprint $table) {
            $table->date('queue_date');
            $table->string('queue_type', 20);
            if (DB::connection()->getDriverName() === 'pgsql') {
                $table->bigInteger('last_number')->default(0);
            } else {
                $table->unsignedInteger('last_number')->default(0);
            }
            $table->primary(['queue_date', 'queue_type']);
        });
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE clinic_queue_locks ADD CONSTRAINT clinic_queue_locks_id_unsigned
                CHECK (id BETWEEN 0 AND 4294967295)');
            DB::statement('ALTER TABLE clinic_queue_counters ADD CONSTRAINT clinic_queue_counters_number_unsigned
                CHECK (last_number BETWEEN 0 AND 4294967295)');
        }
    }

    public function down()
    {
        Schema::dropIfExists('clinic_queue_counters');
        Schema::dropIfExists('clinic_queue_locks');
        Schema::dropIfExists('password_resets');
    }
};
