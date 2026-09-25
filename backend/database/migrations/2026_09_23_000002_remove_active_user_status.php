<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        /*
         * Add archive columns individually.
         * The previous migration attempt may have
         * created these columns before it failed.
         */

        if (!Schema::hasColumn('users', 'archive_reason')) {
            Schema::table('users', function (Blueprint $table) {
                $table->text('archive_reason')->nullable();
            });
        }

        if (!Schema::hasColumn('users', 'archived_by')) {
            Schema::table('users', function (Blueprint $table) {
                $table->foreignUuid('archived_by')
                    ->nullable()
                    ->constrained('users')
                    ->onDelete('set null');
            });
        }

        if (!Schema::hasColumn('users', 'archived_at')) {
            Schema::table('users', function (Blueprint $table) {
                $table->timestamp('archived_at')->nullable();
            });
        }

        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql') {

            /*
             * Step 1:
             * Allow NULL while retaining 'active'
             * as a valid ENUM value.
             */

            DB::statement(
                "ALTER TABLE users
                 MODIFY status
                 ENUM('pending','active','inactive','archived')
                 NULL DEFAULT NULL"
            );

            /*
             * Step 2:
             * Convert existing active accounts
             * to NULL, the new normal status.
             */

            DB::table('users')
                ->where('status', 'active')
                ->update([
                    'status' => null
                ]);

            /*
             * Step 3:
             * Remove 'active' from the ENUM.
             */

            DB::statement(
                "ALTER TABLE users
                 MODIFY status
                 ENUM('pending','inactive','archived')
                 NULL DEFAULT NULL"
            );

        } elseif ($driver === 'pgsql') {

            /*
             * PostgreSQL:
             * Allow NULL and remove the old default.
             */

            DB::statement(
                'ALTER TABLE users
                 ALTER COLUMN status DROP NOT NULL'
            );

            DB::statement(
                'ALTER TABLE users
                 ALTER COLUMN status DROP DEFAULT'
            );

            DB::table('users')
                ->where('status', 'active')
                ->update([
                    'status' => null
                ]);
            // Laravel enums are CHECK constraints on PostgreSQL, not native enums.
            // Replace the check only after converting existing active accounts.
            DB::statement(
                "ALTER TABLE users
                 DROP CONSTRAINT users_status_check,
                 ADD CONSTRAINT users_status_check
                 CHECK (status IN ('pending','inactive','archived'))"
            );
        }
    }

    public function down()
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql') {

            /*
             * Restore the old ENUM before
             * converting NULL back to active.
             */

            DB::statement(
                "ALTER TABLE users
                 MODIFY status
                 ENUM('pending','active','inactive','archived')
                 NULL DEFAULT NULL"
            );

            DB::table('users')
                ->whereNull('status')
                ->update([
                    'status' => 'active'
                ]);

            /*
             * Restore the original NOT NULL column.
             */

            DB::statement(
                "ALTER TABLE users
                 MODIFY status
                 ENUM('pending','active','inactive','archived')
                 NOT NULL DEFAULT 'pending'"
            );

        } elseif ($driver === 'pgsql') {

            // Permit active again before restoring the legacy non-null values.
            DB::statement(
                "ALTER TABLE users
                 DROP CONSTRAINT users_status_check,
                 ADD CONSTRAINT users_status_check
                 CHECK (status IN ('pending','active','inactive','archived'))"
            );

            DB::table('users')
                ->whereNull('status')
                ->update([
                    'status' => 'active'
                ]);

            DB::statement(
                "ALTER TABLE users
                 ALTER COLUMN status SET DEFAULT 'pending'"
            );

            DB::statement(
                'ALTER TABLE users
                 ALTER COLUMN status SET NOT NULL'
            );
        }

        /*
         * Remove archive columns when rolling back.
         */

        if (Schema::hasColumn('users', 'archived_by')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropForeign(['archived_by']);
                $table->dropColumn('archived_by');
            });
        }

        if (Schema::hasColumn('users', 'archive_reason')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('archive_reason');
            });
        }

        if (Schema::hasColumn('users', 'archived_at')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('archived_at');
            });
        }
    }
};
