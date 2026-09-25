<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('medicines', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('generic_name')->nullable();
            $table->string('category')->nullable(); // Pain relief, Antibiotic, etc.
            $table->integer('quantity')->default(0);
            $table->integer('minimum_stock')->default(10);
            $table->string('unit')->default('tablet'); // tablet, ml, bottle, etc.
            $table->string('dosage')->nullable(); // 500mg, 10ml, etc.
            $table->date('expiry_date')->nullable();
            $table->text('description')->nullable();
            $table->uuid('added_by')->nullable();
            $table->foreign('added_by')->references('id')->on('users')->onDelete('set null');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down()
    {
        Schema::dropIfExists('medicines');
    }
};