<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('student_profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->onDelete('cascade')->unique();
            $table->string('course', 100)->nullable();
            $table->string('year', 10)->nullable();
            $table->string('section', 10)->nullable();
            $table->date('birthday')->nullable();
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->string('mobile_number', 20)->nullable();
            $table->text('address')->nullable();
            $table->string('profile_picture')->nullable();
            $table->string('guardian_name')->nullable();
            $table->string('guardian_relationship')->nullable();
            $table->string('guardian_contact', 20)->nullable();
            $table->timestamps();
            
            $table->index('course');
            $table->index('year');
        });
    }

    public function down()
    {
        Schema::dropIfExists('student_profiles');
    }
};