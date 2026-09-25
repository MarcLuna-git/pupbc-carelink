<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('consultations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('appointment_id')->nullable()->constrained('appointments')->onDelete('set null');
            $table->foreignUuid('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignUuid('nurse_id')->constrained('users')->onDelete('cascade');
            $table->text('chief_complaint')->nullable();
            $table->json('vital_signs')->nullable()->comment('{bp, hr, rr, temp, o2_sat}');
            $table->text('general_remarks')->nullable();
            $table->boolean('medical_certificate')->default(false);
            $table->string('medical_certificate_ref')->nullable();
            $table->boolean('follow_up_required')->default(false);
            $table->date('follow_up_date')->nullable();
            $table->enum('status', ['in_progress', 'completed', 'cancelled'])->default('in_progress');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['user_id', 'created_at']);
            $table->index(['nurse_id', 'created_at']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('consultations');
    }
};