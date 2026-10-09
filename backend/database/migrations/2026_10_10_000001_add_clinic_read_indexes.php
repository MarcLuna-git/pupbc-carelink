<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::table('appointment_checkins', function (Blueprint $table) {
            $table->index(['appointment_id', 'is_walk_in'], 'checkins_visit_lookup');
            $table->index(['is_walk_in', 'status', 'created_at'], 'checkins_active_day');
        });
        Schema::table('notifications', function (Blueprint $table) {
            $table->index(['user_id', 'created_at'], 'notifications_user_timeline');
        });
    }

    public function down()
    {
        Schema::table('notifications', function (Blueprint $table) { $table->dropIndex('notifications_user_timeline'); });
        Schema::table('appointment_checkins', function (Blueprint $table) {
            $table->dropIndex('checkins_visit_lookup');
            $table->dropIndex('checkins_active_day');
        });
    }
};
