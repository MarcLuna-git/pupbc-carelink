<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // Clinic-wide options the nurse can change (e.g. Consultation → Queue options → arrival time).
        // Kept in the database, not the cache, so a redeploy does not reset them.
        if (!Schema::hasTable('clinic_settings')) {
            Schema::create('clinic_settings', function (Blueprint $table) {
                $table->string('key', 100)->primary();
                $table->text('value')->nullable();
                $table->foreignUuid('updated_by')->nullable()->constrained('users')->onDelete('set null');
                $table->timestamps();
            });
        }
    }

    public function down()
    {
        Schema::dropIfExists('clinic_settings');
    }
};
