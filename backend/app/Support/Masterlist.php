<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/*
 * The school's list of enrolled students (table student_masterlist).
 *
 * Two file layouts are read:
 *  1. Grouped: a course title row such as "BS in Information Technology (BSIT)", then one row
 *     per student with the Student ID and the name ("Last, First M.").
 *  2. Table: a header row (Student ID, Last Name, First Name, Course, Year Level, Section ...).
 *
 * When the clinic turns it on, a student can only register when their Student ID and last name
 * are on the list of an active academic period.
 */
class Masterlist
{
    public const SETTING_KEY = 'registration_requires_masterlist';
    public const ID_PATTERN = '/^\d{4}-\d{5}-BN-[01]$/';
    private const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];

    private const HEADERS = [
        'student_id' => ['studentid', 'studentno', 'studentnumber', 'idnumber', 'idno', 'id'],
        'last_name' => ['lastname', 'surname', 'familyname'],
        'first_name' => ['firstname', 'givenname'],
        'middle_name' => ['middlename', 'middleinitial', 'mi'],
        'name' => ['name', 'fullname', 'studentname', 'nameofstudent'],
        'course' => ['course', 'program', 'courseprogram', 'degree'],
        'year' => ['year', 'yearlevel', 'yr', 'level'],
        'section' => ['section', 'sec'],
    ];

    // ── Settings ────────────────────────────────────────────────────────────

    public static function required(): bool
    {
        return Schema::hasTable('student_masterlist');
    }

    public static function setRequired(bool $on, ?string $userId): void
    {
        $values = ['value' => $on ? '1' : '0', 'updated_by' => $userId, 'updated_at' => now()];
        if (!DB::table('clinic_settings')->where('key', self::SETTING_KEY)->update($values)) {
            DB::table('clinic_settings')->insert($values + ['key' => self::SETTING_KEY, 'created_at' => now()]);
        }
    }

    /** @return array<int, string> */
    public static function activePeriodIds(): array
    {
        return DB::table('academic_periods')->where('is_active', true)->pluck('id')->all();
    }

    public static function activeCount(): int
    {
        $periods = self::activePeriodIds();
        return $periods ? DB::table('student_masterlist')->whereIn('academic_period_id', $periods)->count() : 0;
    }

    // ── Registration check ──────────────────────────────────────────────────

    /**
     * Throws a validation error when the masterlist check is on and the student is not on the
     * list of an active period. Missing ID and wrong last name give the same message, so the
     * form cannot be used to find out who is on the list.
     */
    public static function assertCanRegister(array $data): void
    {
        if (!Schema::hasTable('student_masterlist') || !self::required()) return;

        $notFound = 'We could not find your Student ID and last name in the school list. Check them, or visit the clinic for help.';
        $periods = self::activePeriodIds();
        $entries = $periods
            ? DB::table('student_masterlist')
                ->leftJoin('courses', 'courses.id', '=', 'student_masterlist.course_id')
                ->whereIn('student_masterlist.academic_period_id', $periods)
                ->where('student_masterlist.student_id', strtoupper(trim((string) ($data['student_id'] ?? ''))))
                ->get(['student_masterlist.*', 'courses.code as current_course_code'])
            : collect();

        $entry = $entries->first(fn ($row) => self::lastNameMatches((string) ($data['last_name'] ?? ''), $row));
        if (!$entry) throw ValidationException::withMessages(['student_id' => $notFound]);

        $errors = [];
        $course = $entry->current_course_code ?: $entry->course_code;
        if ($course && strcasecmp($course, (string) ($data['course'] ?? '')) !== 0) {
            $errors['course'] = 'This course does not match your record in the school list.';
        }
        if ($entry->year_level && strcasecmp($entry->year_level, (string) ($data['year'] ?? '')) !== 0) {
            $errors['year'] = 'This year level does not match your record in the school list.';
        }
        if ($entry->section && strcasecmp($entry->section, (string) ($data['section'] ?? '')) !== 0) {
            $errors['section'] = 'This section does not match your record in the school list.';
        }
        if ($errors) throw ValidationException::withMessages($errors);
    }

    /*
     * "unchecked" when the check is off. Otherwise "not_found" when the ID is not on an active
     * period's list, "registered" when it is on the list but already has an account (archived
     * accounts count, as on submit), and "found" when it is free to sign up.
     */
    public static function idStatus(string $studentId): string
    {
        if (!Schema::hasTable('student_masterlist') || !self::required()) return 'unchecked';
        $periods = self::activePeriodIds();
        $found = $periods && DB::table('student_masterlist')
            ->whereIn('academic_period_id', $periods)
            ->where('student_id', $studentId)
            ->exists();
        if (!$found) return 'not_found';
        return \App\Models\User::withTrashed()->where('student_id', $studentId)->exists() ? 'registered' : 'found';
    }

    public static function lastNameMatches(string $lastName, object $entry): bool
    {
        $typed = self::nameKey($lastName);
        if (strlen($typed) < 2) return false;
        if ($typed === self::nameKey((string) $entry->last_name)) return true;
        // A name written without a comma ("Dela Cruz Juan") has no clear last name, so a
        // last name that starts the full name is accepted.
        return !str_contains((string) $entry->full_name, ',') && str_starts_with(self::nameKey((string) $entry->full_name), $typed);
    }

    // Letters only, no accents or case: "Señar" = "senar", "Domat-ol" = "domatol".
    public static function nameKey(string $name): string
    {
        return preg_replace('/[^a-z]/', '', strtolower(Str::ascii($name))) ?? '';
    }

    // ── File parsing ────────────────────────────────────────────────────────

    /**
     * @param array<int, array{0: int, 1: array<int, string>}> $rows
     * @return array{entries: array, errors: array, new_courses: array}
     */
    public static function parse(array $rows): array
    {
        $courses = self::courseIndex();
        $map = null;
        $currentCourse = null;
        $entries = [];
        $errors = [];
        $newCourses = [];
        $seen = [];

        foreach ($rows as [$line, $cells]) {
            if ($map === null && ($header = self::headerMap($cells))) { $map = $header; continue; }

            $id = $map !== null && isset($map['student_id']) ? ($cells[$map['student_id']] ?? '') : self::firstIdLike($cells);
            if ($id === '') {
                // A row with one filled cell and no Student ID is a course title.
                $filled = array_values(array_filter($cells, fn ($cell) => $cell !== ''));
                if (count($filled) === 1 && !preg_match('/\d{4}-\d/', $filled[0])) {
                    $currentCourse = self::resolveCourse($filled[0], $courses, $newCourses);
                    if (!$currentCourse) $errors[] = ['line' => $line, 'student_id' => '', 'name' => $filled[0], 'message' => 'This looks like a course title, but no course could be read from it.'];
                    continue;
                }
                $errors[] = ['line' => $line, 'student_id' => '', 'name' => implode(' ', $filled), 'message' => 'Student ID is missing.'];
                continue;
            }

            $studentId = strtoupper(preg_replace('/\s+/', '', $id));
            $name = self::nameFrom($cells, $map, $id);
            $entry = ['line' => $line, 'student_id' => $studentId, 'full_name' => $name['full'], 'last_name' => $name['last'], 'first_name' => $name['first'], 'warning' => $name['warning']];

            if (!preg_match(self::ID_PATTERN, $studentId)) { $errors[] = self::error($entry, 'Student ID must look like 2023-00000-BN-0.'); continue; }
            if ($name['full'] === '' || $name['last'] === '') { $errors[] = self::error($entry, 'Name is missing.'); continue; }
            if (mb_strlen($name['full']) > 255 || mb_strlen($name['last']) > 100) { $errors[] = self::error($entry, 'Name is too long.'); continue; }
            if (isset($seen[$studentId])) { $errors[] = self::error($entry, "This Student ID is also on line {$seen[$studentId]}."); continue; }

            $course = $currentCourse;
            if ($map !== null && isset($map['course']) && ($cells[$map['course']] ?? '') !== '') {
                $course = self::resolveCourse($cells[$map['course']], $courses, $newCourses);
                if (!$course) { $errors[] = self::error($entry, 'Course could not be read.'); continue; }
            }
            if ($course && !empty($course['deleted'])) { $errors[] = self::error($entry, "Course {$course['code']} was deleted in Course Management."); continue; }

            $year = $map !== null && isset($map['year']) ? self::year($cells[$map['year']] ?? '') : null;
            if ($year === false) { $errors[] = self::error($entry, 'Year level could not be read. Use 1, 2, 3, 4, or "1st Year".'); continue; }
            $section = $map !== null && isset($map['section']) ? self::section($cells[$map['section']] ?? '') : null;
            if ($section === false) { $errors[] = self::error($entry, 'Section could not be read. Use a code like 3-1.'); continue; }

            $seen[$studentId] = $line;
            $entries[] = $entry + [
                'course_id' => $course['id'] ?? null,
                'course_code' => $course['code'] ?? null,
                'new_course' => $course && empty($course['id']),
                'year_level' => $year ?: null,
                'section' => $section ?: null,
            ];
        }

        return ['entries' => $entries, 'errors' => $errors, 'new_courses' => array_values($newCourses)];
    }

    private static function error(array $entry, string $message): array
    {
        return ['line' => $entry['line'], 'student_id' => $entry['student_id'], 'name' => $entry['full_name'], 'message' => $message];
    }

    private static function headerMap(array $cells): ?array
    {
        $map = [];
        foreach ($cells as $index => $cell) {
            $key = preg_replace('/[^a-z]/', '', strtolower($cell));
            foreach (self::HEADERS as $field => $names) {
                if (!isset($map[$field]) && in_array($key, $names, true)) { $map[$field] = $index; break; }
            }
        }
        return isset($map['student_id']) && (isset($map['name']) || isset($map['last_name'])) ? $map : null;
    }

    private static function firstIdLike(array $cells): string
    {
        foreach ($cells as $cell) {
            if (preg_match('/^\d{4}\s*-/', $cell)) return $cell;
        }
        return '';
    }

    /** @return array{full: string, last: string, first: ?string, warning: ?string} */
    private static function nameFrom(array $cells, ?array $map, string $id): array
    {
        if ($map !== null && isset($map['last_name'])) {
            $last = $cells[$map['last_name']] ?? '';
            $first = trim(($cells[$map['first_name'] ?? -1] ?? '') . ' ' . ($cells[$map['middle_name'] ?? -1] ?? ''));
            return ['full' => trim($last . ($first !== '' ? ', ' . $first : '')), 'last' => $last, 'first' => $first ?: null, 'warning' => null];
        }

        $full = $map !== null ? ($cells[$map['name']] ?? '') : '';
        if ($map === null) {
            // Without a header, the name is the first filled cell after the Student ID.
            $afterId = false;
            foreach ($cells as $cell) {
                if ($afterId && $cell !== '') { $full = $cell; break; }
                if ($cell === $id) $afterId = true;
            }
        }

        if (str_contains($full, ',')) {
            [$last, $first] = array_map('trim', explode(',', $full, 2));
            return ['full' => $full, 'last' => $last, 'first' => $first ?: null, 'warning' => null];
        }
        $parts = preg_split('/\s+/', $full, 2);
        return [
            'full' => $full,
            'last' => $parts[0] ?? '',
            'first' => $parts[1] ?? null,
            'warning' => $full !== '' ? 'No comma in the name, so the first word is read as the last name.' : null,
        ];
    }

    /** @return string|false|null */
    private static function year(string $value)
    {
        if ($value === '') return null;
        if (preg_match('/^([1-5])/', $value, $match)) return self::YEARS[(int) $match[1] - 1];
        return false;
    }

    /** @return string|false|null */
    private static function section(string $value)
    {
        if ($value === '') return null;
        if (preg_match('/(\d+\s*-\s*\d+)/', $value, $match)) return preg_replace('/\s+/', '', $match[1]);
        return preg_match('/^[\pL\d-]{1,10}$/u', $value) ? $value : false;
    }

    // ── Courses ─────────────────────────────────────────────────────────────

    private static function courseIndex(): array
    {
        $index = [];
        foreach (DB::table('courses')->get(['id', 'code', 'name', 'deleted_at']) as $course) {
            $item = ['id' => $course->id, 'code' => $course->code, 'name' => $course->name, 'deleted' => (bool) $course->deleted_at];
            $index['code:' . self::codeKey($course->code)] ??= $item;
            $index['name:' . self::courseNameKey($course->name)] ??= $item;
        }
        return $index;
    }

    /**
     * "BS in Computer Engineering (BSCpE)" → the BSCPE course. A course that is not in
     * Course Management yet is returned without an id and added when the file is imported.
     */
    private static function resolveCourse(string $text, array $courses, array &$newCourses): ?array
    {
        $code = preg_match('/\(([^)]+)\)\s*$/', $text, $match) ? trim($match[1]) : null;
        $name = trim(preg_replace('/\([^)]*\)\s*$/', '', $text));
        if ($code === null && preg_match('/^[\pL\d -]{2,15}$/u', $text) && !str_contains(trim($text), ' ')) $code = $text;

        foreach (array_filter([$code, $name, $text]) as $candidate) {
            if ($found = $courses['code:' . self::codeKey($candidate)] ?? null) return $found;
        }
        if ($name !== '' && ($found = $courses['name:' . self::courseNameKey($name)] ?? null)) return $found;
        if (!$code) return null;

        $newCode = substr(preg_replace('/[^\pL\d-]+/u', '-', trim($code)), 0, 50);
        $newCode = trim(strtoupper($newCode), '-');
        if ($newCode === '') return null;
        $key = self::codeKey($newCode);
        return $newCourses[$key] ??= ['id' => null, 'code' => $newCode, 'name' => $name !== '' ? self::expandCourseName($name) : $newCode];
    }

    private static function codeKey(string $code): string
    {
        return preg_replace('/[^A-Z0-9]/', '', strtoupper(Str::ascii($code))) ?? '';
    }

    private static function courseNameKey(string $name): string
    {
        return preg_replace('/[^a-z]/', '', strtolower(self::expandCourseName($name))) ?? '';
    }

    private static function expandCourseName(string $name): string
    {
        return preg_replace(['/^BS\s+in\s+/i', '/^BS\s+/i', '/^AB\s+in\s+/i'], ['Bachelor of Science in ', 'Bachelor of Science in ', 'Bachelor of Arts in '], trim($name));
    }
}
