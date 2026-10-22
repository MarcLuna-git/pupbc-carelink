<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CreateCalendarNotesTable extends Migration
{
    public function up()
    {
        // Clinic-wide notes pinned to a calendar date (meetings, reminders) on the nurse dashboard.
        Schema::create('calendar_notes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->date('note_date')->index();
            $table->string('title', 120);
            $table->text('details')->nullable();
            $table->string('color', 20)->default('maroon');
            $table->foreignUuid('created_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();
        });

        if (!DB::table('nurse_sync_revisions')->where('topic', 'calendar')->exists()) {
            DB::table('nurse_sync_revisions')->insert(['topic' => 'calendar', 'revision' => 0]);
        }
    }

    public function down()
    {
        DB::table('nurse_sync_revisions')->where('topic', 'calendar')->delete();
        Schema::dropIfExists('calendar_notes');
    }
}
