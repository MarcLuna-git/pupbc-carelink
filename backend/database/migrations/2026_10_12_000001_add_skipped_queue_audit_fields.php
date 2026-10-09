<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::table('appointment_checkins', function (Blueprint $table) {
            foreach (['skipped_at', 'returned_at'] as $column) {
                if (!Schema::hasColumn('appointment_checkins', $column)) {
                    $table->timestamp($column)->nullable();
                }
            }
            foreach (['skipped_by', 'returned_by'] as $column) {
                if (!Schema::hasColumn('appointment_checkins', $column)) {
                    $table->foreignUuid($column)->nullable()->constrained('users')->onDelete('set null');
                }
            }
        });
    }

    public function down()
    {
        // Retain additive audit fields/data, including columns up() may have
        // reused. Reapplication is safe; clinical history must not be erased.
    }
};
