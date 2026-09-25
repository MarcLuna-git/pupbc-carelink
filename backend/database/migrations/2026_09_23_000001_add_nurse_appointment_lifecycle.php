<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('appointments', function (Blueprint $table) {
            if (!Schema::hasColumn('appointments', 'cancellation_reason')) {
                $table->text('cancellation_reason')->nullable();
            }
            if (!Schema::hasColumn('appointments', 'cancelled_by')) {
                $table->foreignUuid('cancelled_by')->nullable()->constrained('users')->onDelete('set null');
            }
            if (!Schema::hasColumn('appointments', 'cancelled_at')) {
                $table->timestamp('cancelled_at')->nullable();
            }
        });

        $driver = DB::connection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE appointments MODIFY status ENUM('pending','approved','rejected','completed','cancelled','expired') NOT NULL DEFAULT 'pending'");
        } elseif ($driver === 'pgsql') {
            DB::statement("ALTER TABLE appointments
                DROP CONSTRAINT appointments_status_check,
                ADD CONSTRAINT appointments_status_check
                CHECK (status IN ('pending','approved','rejected','completed','cancelled','expired'))");
        }
    }

    public function down()
    {
        $driver = DB::connection()->getDriverName();
        if ($driver === 'mysql') {
            DB::table('appointments')->where('status', 'expired')->update(['status' => 'rejected']);
            DB::statement("ALTER TABLE appointments MODIFY status ENUM('pending','approved','rejected','completed','cancelled') NOT NULL DEFAULT 'pending'");
        } elseif ($driver === 'pgsql') {
            DB::table('appointments')->where('status', 'expired')->update(['status' => 'rejected']);
            DB::statement("ALTER TABLE appointments
                DROP CONSTRAINT appointments_status_check,
                ADD CONSTRAINT appointments_status_check
                CHECK (status IN ('pending','approved','rejected','completed','cancelled'))");
        }

        Schema::table('appointments', function (Blueprint $table) {
            if (Schema::hasColumn('appointments', 'cancelled_by')) {
                $table->dropForeign(['cancelled_by']);
                $table->dropColumn('cancelled_by');
            }
            foreach (['cancellation_reason', 'cancelled_at'] as $column) {
                if (Schema::hasColumn('appointments', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
