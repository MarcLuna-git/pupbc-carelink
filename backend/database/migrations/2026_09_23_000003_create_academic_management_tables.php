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
         * 1. Academic periods
         *
         * The table may already exist because a previous
         * migration attempt failed while creating its
         * unique index.
         */
        if (!Schema::hasTable('academic_periods')) {
            Schema::create('academic_periods', function (Blueprint $table) {
                $table->uuid('id')->primary();
                if (DB::connection()->getDriverName() === 'pgsql') {
                    $table->integer('academic_year_start');
                    $table->integer('academic_year_end');
                } else {
                    $table->unsignedSmallInteger('academic_year_start');
                    $table->unsignedSmallInteger('academic_year_end');
                }
                $table->string('semester', 30);
                $table->boolean('is_active')->default(false);
                $table->timestamps();

                // Explicit short name avoids MySQL's
                // 64-character identifier limit.
                $table->unique(
                    [
                        'academic_year_start',
                        'academic_year_end',
                        'semester'
                    ],
                    'academic_periods_year_semester_unique'
                );
            });
            if (DB::connection()->getDriverName() === 'pgsql') {
                DB::statement('ALTER TABLE academic_periods
                    ADD CONSTRAINT academic_periods_year_start_unsigned CHECK (academic_year_start BETWEEN 0 AND 65535),
                    ADD CONSTRAINT academic_periods_year_end_unsigned CHECK (academic_year_end BETWEEN 0 AND 65535)');
            }
        } else {
            /*
             * Repair an existing table left by a
             * partially completed migration.
             */

            $indexes = $this->uniqueIndexColumns();

            $hasPrimary = false;
            $hasYearSemesterUnique = false;
            $uniqueIndexes = [];

            foreach ($indexes as $index) {
                if ((int) $index->is_primary === 1) {
                    $hasPrimary = true;
                }

                $name = $index->index_name;

                if (!isset($uniqueIndexes[$name])) {
                    $uniqueIndexes[$name] = [];
                }

                $uniqueIndexes[$name][
                    (int) $index->ordinal_position
                ] = $index->column_name;
            }

            foreach ($uniqueIndexes as $columns) {
                ksort($columns);

                if (array_values($columns) === [
                    'academic_year_start',
                    'academic_year_end',
                    'semester'
                ]) {
                    $hasYearSemesterUnique = true;
                    break;
                }
            }

            if (!$hasPrimary) {
                Schema::table('academic_periods', function (Blueprint $table) {
                    $table->primary('id');
                });
            }

            if (!$hasYearSemesterUnique) {
                Schema::table('academic_periods', function (Blueprint $table) {
                    $table->unique(
                        [
                            'academic_year_start',
                            'academic_year_end',
                            'semester'
                        ],
                        'academic_periods_year_semester_unique'
                    );
                });
            }
        }

        /*
         * 2. Courses
         */
        if (!Schema::hasTable('courses')) {
            Schema::create('courses', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('code', 50)->unique();
                $table->string('name', 150);
                $table->boolean('is_active')->default(true);
                $table->timestamps();
                $table->softDeletes();
            });
        }

        /*
         * 3. Course sections
         */
        if (!Schema::hasTable('course_sections')) {
            Schema::create('course_sections', function (Blueprint $table) {
                $table->uuid('id')->primary();

                $table->foreignUuid('academic_period_id')
                    ->constrained('academic_periods')
                    ->onDelete('cascade');

                $table->foreignUuid('course_id')
                    ->constrained('courses')
                    ->onDelete('cascade');

                $table->string('year_level', 30);
                $table->string('section_code', 30);
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->unique(
                    [
                        'academic_period_id',
                        'course_id',
                        'year_level',
                        'section_code'
                    ],
                    'course_section_assignment_unique'
                );
            });
        }

        /*
         * 4. Student enrollments
         */
        if (!Schema::hasTable('student_enrollments')) {
            Schema::create('student_enrollments', function (Blueprint $table) {
                $table->uuid('id')->primary();

                $table->foreignUuid('user_id')
                    ->constrained('users')
                    ->onDelete('cascade');

                $table->foreignUuid('course_section_id')
                    ->constrained('course_sections')
                    ->onDelete('restrict');

                $table->string('status', 30)->default('enrolled');
                $table->date('enrolled_at')->nullable();
                $table->timestamps();

                $table->unique([
                    'user_id',
                    'course_section_id'
                ]);

                $table->index([
                    'user_id',
                    'status'
                ]);
            });
        }
    }

    private function uniqueIndexColumns(): array
    {
        $connection = DB::connection();
        $table = $connection->getTablePrefix() . 'academic_periods';

        if ($connection->getDriverName() === 'mysql') {
            return $connection->select(
                "SELECT index_name AS index_name, column_name AS column_name, seq_in_index AS ordinal_position,
                        CASE WHEN index_name = 'PRIMARY' THEN 1 ELSE 0 END AS is_primary
                 FROM information_schema.statistics
                 WHERE table_schema = DATABASE() AND table_name = ? AND non_unique = 0
                   AND index_name NOT IN (
                       SELECT index_name FROM information_schema.statistics
                       WHERE table_schema = DATABASE() AND table_name = ? AND sub_part IS NOT NULL
                   )
                 ORDER BY index_name, seq_in_index",
                [$table, $table]
            );
        }

        if ($connection->getDriverName() === 'pgsql') {
            // Resolve the same table as Laravel's search_path. Include standalone
            // unique indexes, but not partial, expression, or invalid indexes.
            return $connection->select(
                'SELECT idx.relname AS index_name, attr.attname AS column_name,
                        key.ordinality AS ordinal_position,
                        CASE WHEN ind.indisprimary THEN 1 ELSE 0 END AS is_primary
                 FROM pg_catalog.pg_index ind
                 JOIN pg_catalog.pg_class idx ON idx.oid = ind.indexrelid
                 CROSS JOIN LATERAL unnest(ind.indkey) WITH ORDINALITY AS key(attnum, ordinality)
                 JOIN pg_catalog.pg_attribute attr
                   ON attr.attrelid = ind.indrelid AND attr.attnum = key.attnum
                 WHERE ind.indrelid = to_regclass(?) AND ind.indisunique AND ind.indisvalid
                   AND ind.indpred IS NULL AND ind.indexprs IS NULL
                   AND key.ordinality <= ind.indnkeyatts
                 ORDER BY idx.relname, key.ordinality',
                [$table]
            );
        }

        throw new \RuntimeException('Academic index repair requires MySQL/MariaDB or PostgreSQL.');
    }

    public function down()
    {
        Schema::dropIfExists('student_enrollments');
        Schema::dropIfExists('course_sections');
        Schema::dropIfExists('courses');
        Schema::dropIfExists('academic_periods');
    }
};
