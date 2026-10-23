<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateStudentAttachmentsTable extends Migration
{
    public function up()
    {
        // Extra record files a nurse attaches to a student (x-ray photos, lab results, documents).
        // Medical files are private: they are never put in media_files, whose route is public.
        Schema::create('student_attachments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignUuid('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('category', 30)->default('other');
            $table->string('description', 255)->nullable();
            $table->string('original_name', 255);
            $table->string('mime_type', 100);
            $table->unsignedInteger('size');
            $table->string('path')->unique();
            // Database copy, because Render's disk is wiped on every deploy/restart.
            // Base64 text works the same on MySQL (LONGTEXT) and PostgreSQL.
            $table->longText('contents');
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('student_attachments');
    }
}
