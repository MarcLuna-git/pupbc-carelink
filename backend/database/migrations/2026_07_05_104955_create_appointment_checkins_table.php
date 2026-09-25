<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('appointment_checkins', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('appointment_id')->constrained('appointments')->onDelete('cascade');
            $table->foreignUuid('user_id')->constrained('users')->onDelete('cascade');
            $table->timestamp('checked_in_at');
            $table->text('chief_complaint')->nullable();
            $table->enum('checkin_status', ['confirmed', 'no_show'])->default('confirmed');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('appointment_checkins');
    }
};