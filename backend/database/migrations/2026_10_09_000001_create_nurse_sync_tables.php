<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CreateNurseSyncTables extends Migration
{
    public function up()
    {
        Schema::create('nurse_sync_revisions', function (Blueprint $table) {
            $table->string('topic', 40)->primary();
            $table->unsignedBigInteger('revision')->default(0);
        });
        foreach (['appointments', 'queue', 'consultations', 'medicines', 'students', 'academic', 'announcements', 'notifications'] as $topic) {
            DB::table('nurse_sync_revisions')->insert(['topic' => $topic, 'revision' => 0]);
        }
        Schema::create('nurse_operations', function (Blueprint $table) {
            $table->string('operation_key', 64)->primary();
            $table->string('request_hash', 64);
            $table->unsignedSmallInteger('status');
            $table->longText('response');
            $table->timestamp('created_at')->index();
        });
        Schema::create('nurse_visit_claims', function (Blueprint $table) {
            $table->uuid('checkin_id')->primary();
            $table->string('session_hash', 64);
            $table->timestamp('expires_at');
        });
    }

    public function down()
    {
        Schema::dropIfExists('nurse_visit_claims');
        Schema::dropIfExists('nurse_operations');
        Schema::dropIfExists('nurse_sync_revisions');
    }
}
