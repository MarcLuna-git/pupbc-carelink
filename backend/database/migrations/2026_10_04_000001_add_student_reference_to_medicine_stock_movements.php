<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('medicine_stock_movements', function (Blueprint $table) {
            $table->foreignUuid('student_user_id')
                ->nullable()
                ->after('performed_by')
                ->constrained('users')
                ->onDelete('set null');
        });
    }

    public function down()
    {
        Schema::table('medicine_stock_movements', function (Blueprint $table) {
            $table->dropForeign(['student_user_id']);
            $table->dropColumn('student_user_id');
        });
    }
};
