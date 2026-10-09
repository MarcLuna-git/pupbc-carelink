<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // The 2026_09_23 lifecycle migration owns appointment statuses, including
        // expired (a CHECK constraint on PostgreSQL). Do not alter it here.

        // Add called_at, called_by, and no_show fields to appointment_checkins
        Schema::table('appointment_checkins', function (Blueprint $table) {
            if (!Schema::hasColumn('appointment_checkins', 'called_at')) {
                $table->timestamp('called_at')->nullable();
            }
            if (!Schema::hasColumn('appointment_checkins', 'called_by')) {
                $table->foreignUuid('called_by')->nullable()->constrained('users')->onDelete('set null');
            }
            if (!Schema::hasColumn('appointment_checkins', 'no_show_at')) {
                $table->timestamp('no_show_at')->nullable();
            }
            if (!Schema::hasColumn('appointment_checkins', 'no_show_by')) {
                $table->foreignUuid('no_show_by')->nullable()->constrained('users')->onDelete('set null');
            }
        });

        // Add index for called appointments
        if (!$this->hasCalledStatusIndex()) {
            Schema::table('appointment_checkins', function (Blueprint $table) {
                $table->index(['status', 'called_at'], 'checkins_called_status');
            });
        }
    }

    public function down()
    {
        // Intentionally retain additive audit schema and data on rollback.
        // up() may have reused existing columns/indexes; we cannot safely claim
        // ownership or delete clinical audit history. Reapplying up() is safe.
        // Appointment statuses remain owned by the earlier lifecycle migration.
    }

    private function hasCalledStatusIndex(): bool
    {
        $connection = DB::connection();
        $driver = $connection->getDriverName();
        if ($driver === 'mysql') {
            return count($connection->select(
                'SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?',
                ['appointment_checkins', 'checkins_called_status']
            )) > 0;
        }
        if ($driver === 'pgsql') {
            return count($connection->select(
                "SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE i.indrelid = to_regclass(?) AND c.relname = ?",
                ['appointment_checkins', 'checkins_called_status']
            )) > 0;
        }
        if ($driver === 'sqlite') {
            foreach ($connection->select("PRAGMA index_list('appointment_checkins')") as $index) {
                if ($index->name === 'checkins_called_status') return true;
            }
            return false;
        }

        throw new \RuntimeException('Unsupported database driver for check-in audit migration.');
    }
};
