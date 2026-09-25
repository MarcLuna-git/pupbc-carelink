<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('student_id', 50)->unique()->nullable()->index();
            $table->string('first_name', 100);
            $table->string('middle_name', 100)->nullable();
            $table->string('last_name', 100);
            $table->date('birthday')->nullable();
            $table->string('gender')->nullable();
            $table->string('course')->nullable();
            $table->string('year')->nullable();
            $table->string('section')->nullable();
            $table->string('mobile_number', 20)->nullable();
            $table->string('email', 191)->unique()->index();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->enum('role', ['student', 'nurse'])->default('student');
            $table->enum('status', ['pending', 'active', 'inactive', 'archived'])->default('pending');
            $table->timestamp('last_login_at')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['email', 'status']);
            $table->index(['student_id', 'status']);
            $table->index(['role', 'status']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('users');
    }
};