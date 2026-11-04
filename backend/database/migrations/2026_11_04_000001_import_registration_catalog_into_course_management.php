<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/*
 * Registration now reads courses and sections from Nurse → Course Management.
 * This copies the old registration-academics.json catalog into those tables once,
 * so the form keeps the same options after the switch. It only adds rows that are
 * missing: existing courses, sections, and student records are left as they are.
 */
return new class extends Migration
{
    private const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

    public function up()
    {
        foreach (['academic_periods', 'courses', 'course_sections'] as $table) {
            if (!Schema::hasTable($table)) return;
        }
        $catalog = json_decode(file_get_contents(resource_path('data/registration-academics.json')), true, 512, JSON_THROW_ON_ERROR);

        DB::transaction(function () use ($catalog) {
            $periodId = $this->activePeriodId();
            $now = now();

            foreach ($catalog as $entry) {
                $course = DB::table('courses')->where('code', $entry['code'])->first();
                if (!$course) {
                    $course = (object) ['id' => (string) Str::uuid(), 'deleted_at' => null];
                    DB::table('courses')->insert([
                        'id' => $course->id, 'code' => $entry['code'], 'name' => $entry['name'],
                        'is_active' => true, 'created_at' => $now, 'updated_at' => $now,
                    ]);
                }
                // A course the clinic deleted stays deleted.
                if ($course->deleted_at) continue;

                foreach ($entry['sections'] as $section) {
                    $year = self::YEARS[(int) $section[0] - 1] ?? null;
                    if (!$year) continue;
                    $key = ['academic_period_id' => $periodId, 'course_id' => $course->id, 'year_level' => $year, 'section_code' => $section];
                    if (DB::table('course_sections')->where($key)->exists()) continue;
                    DB::table('course_sections')->insert($key + [
                        'id' => (string) Str::uuid(), 'is_active' => true, 'created_at' => $now, 'updated_at' => $now,
                    ]);
                }
            }
        });
    }

    // The newest active period, or the current school term made active.
    private function activePeriodId(): string
    {
        $active = DB::table('academic_periods')->where('is_active', true)
            ->orderByDesc('academic_year_start')->value('id');
        if ($active) return $active;

        $today = now('Asia/Manila');
        $start = $today->month >= 8 ? $today->year : $today->year - 1;
        $semester = $today->month >= 8 ? '1st Semester' : ($today->month <= 5 ? '2nd Semester' : 'Summer');
        $key = ['academic_year_start' => $start, 'academic_year_end' => $start + 1, 'semester' => $semester];

        $existing = DB::table('academic_periods')->where($key)->value('id');
        if ($existing) {
            DB::table('academic_periods')->where('id', $existing)->update(['is_active' => true, 'updated_at' => now()]);
            return $existing;
        }

        $id = (string) Str::uuid();
        DB::table('academic_periods')->insert($key + ['id' => $id, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
        return $id;
    }

    public function down()
    {
        // Imported rows may already be edited or used by students; they are kept.
    }
};
