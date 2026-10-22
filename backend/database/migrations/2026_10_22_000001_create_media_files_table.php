<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    // Database copy of uploaded images. Render's disk is wiped on every
    // deploy/restart, so the public disk alone cannot keep avatars.
    public function up()
    {
        if (Schema::hasTable('media_files')) {
            return;
        }

        Schema::create('media_files', function (Blueprint $table) {
            $table->string('path')->primary();
            $table->string('mime_type', 100);
            // Base64 text works the same on MySQL (LONGTEXT) and PostgreSQL.
            $table->longText('contents');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('media_files');
    }
};
