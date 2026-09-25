<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('health_profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->onDelete('cascade')->unique();
            
            // Emergency Contact
            $table->string('emergency_name')->nullable();
            $table->string('emergency_relationship')->nullable();
            $table->string('emergency_phone')->nullable();
            
            // Step 2 - Medical History
            $table->json('medical_history')->nullable();
            $table->string('allergy_details', 255)->nullable();
            $table->string('other_medical_history', 255)->nullable();
            $table->text('medications')->nullable();
            
            // Step 3 - Hospitalization, Surgery, COVID
            $table->boolean('hospitalized')->default(false);
            $table->date('hospitalization_date')->nullable();
            $table->string('hospitalization_diagnosis', 255)->nullable();
            $table->boolean('surgery')->default(false);
            $table->date('surgery_date')->nullable();
            $table->string('surgery_diagnosis', 255)->nullable();
            $table->boolean('had_covid')->default(false);
            $table->date('covid_date')->nullable();
            $table->string('covid_diagnosis', 255)->nullable();
            
            // Step 4 - Personal & Social History
            $table->string('occupation', 255)->nullable();
            $table->string('marital_status', 50)->nullable();
            $table->string('tobacco_use', 20)->nullable();
            $table->string('tobacco_amount', 100)->nullable();
            $table->string('tobacco_duration', 100)->nullable();
            $table->string('alcohol_use', 20)->nullable();
            $table->text('other_substance_use')->nullable();
            $table->boolean('has_disability')->default(false);
            $table->text('disability_details')->nullable();
            
            // Female-only fields
            $table->date('last_menstrual_period')->nullable();
            $table->boolean('has_children')->default(false);
            $table->integer('number_of_children')->nullable();
            $table->integer('age_first_pregnancy')->nullable();
            $table->boolean('gravidity')->default(false);
            $table->boolean('term')->default(false);
            $table->boolean('premature')->default(false);
            $table->boolean('abortion')->default(false);
            $table->boolean('living_children')->default(false);
            
            // Step 5 - Family History
            $table->json('family_history')->nullable();
            
            // Step 6 - Consent
            $table->string('consent_signature')->nullable();
            $table->boolean('agree_privacy')->default(false);
            $table->boolean('agree_terms')->default(false);
            $table->date('consent_date')->nullable();
            
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('health_profiles');
    }
};