<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddOnDutyToUsersTable extends Migration
{
    public function up()
    {
        // Nurse duty status (On duty / Off duty), set from the nurse account menu.
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('on_duty')->default(true);
        });
    }

    public function down()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('on_duty');
        });
    }
}
