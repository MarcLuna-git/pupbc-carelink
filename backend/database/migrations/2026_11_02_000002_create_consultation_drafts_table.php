<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // Consultation → visit → "Save progress": the unfinished form of one visit, kept on the
        // server so any nurse device can continue it. Removed when the consultation is saved.
        if (!Schema::hasTable('consultation_drafts')) {
            Schema::create('consultation_drafts', function (Blueprint $table) {
                $table->id();
                $table->foreignUuid('checkin_id')->unique()->constrained('appointment_checkins')->onDelete('cascade');
                $table->json('data');
                $table->foreignUuid('saved_by')->nullable()->constrained('users')->onDelete('set null');
                $table->timestamps();
            });
        }
    }

    public function down()
    {
        Schema::dropIfExists('consultation_drafts');
    }
};
