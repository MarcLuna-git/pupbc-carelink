<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('appointment_slots', function (Blueprint $table) {
            $table->id();
            $table->date('date');
            $table->string('time_slot'); // 8:00 AM, 8:30 AM, etc.
            $table->integer('max_slots')->default(10);
            $table->integer('booked_count')->default(0);
            $table->timestamps();
            
            $table->unique(['date', 'time_slot']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('appointment_slots');
    }
};