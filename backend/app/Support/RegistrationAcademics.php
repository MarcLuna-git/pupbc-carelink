<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/*
 * Courses, year levels, and sections a student can register with, taken from
 * Nurse → Course Management: active courses that have active sections in an
 * active academic period.
 */
class RegistrationAcademics
{
    public const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

    /** @return array<int, array{code: string, name: string, sections: array<int, array{year: string, section: string}>}> */
    public static function courses(): array
    {
        $rows = DB::table('course_sections')
            ->join('courses', 'courses.id', '=', 'course_sections.course_id')
            ->join('academic_periods', 'academic_periods.id', '=', 'course_sections.academic_period_id')
            ->where('course_sections.is_active', true)
            ->where('courses.is_active', true)
            ->whereNull('courses.deleted_at')
            ->where('academic_periods.is_active', true)
            ->orderBy('courses.code')
            ->get(['courses.code', 'courses.name', 'course_sections.year_level', 'course_sections.section_code']);

        $courses = [];
        foreach ($rows as $row) {
            if (!isset($courses[$row->code])) {
                $courses[$row->code] = ['code' => $row->code, 'name' => $row->name, 'sections' => []];
            }
            // Two active periods may list the same section; show it once.
            $section = ['year' => $row->year_level, 'section' => $row->section_code];
            if (!in_array($section, $courses[$row->code]['sections'], true)) {
                $courses[$row->code]['sections'][] = $section;
            }
        }

        foreach ($courses as &$course) {
            usort($course['sections'], fn ($a, $b) => [self::yearOrder($a['year']), $a['section']] <=> [self::yearOrder($b['year']), $b['section']]);
        }

        return array_values($courses);
    }

    public static function find(array $catalog, string $code): ?array
    {
        foreach ($catalog as $course) {
            if ($course['code'] === $code) return $course;
        }
        return null;
    }

    public static function yearsFor(?array $course): array
    {
        $years = array_unique(array_column($course['sections'] ?? [], 'year'));
        usort($years, fn ($a, $b) => self::yearOrder($a) <=> self::yearOrder($b));
        return $years;
    }

    public static function sectionsFor(?array $course, string $year): array
    {
        $sections = array_filter($course['sections'] ?? [], fn ($entry) => $entry['year'] === $year);
        return array_values(array_column($sections, 'section'));
    }

    // Standard year levels first, in order; any custom year level after them.
    private static function yearOrder(string $year): int
    {
        $index = array_search($year, self::YEARS, true);
        return $index === false ? count(self::YEARS) : $index;
    }
}
