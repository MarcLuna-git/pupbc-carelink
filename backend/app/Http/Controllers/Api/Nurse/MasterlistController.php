<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use App\Models\AcademicPeriod;
use App\Models\AuditLog;
use App\Models\Course;
use App\Services\NurseSync;
use App\Support\Masterlist;
use App\Support\MasterlistReader;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/*
 * Students → Masterlist tab (was under Course Management): import the school's list of enrolled students from an
 * Excel or CSV file, look through it, and turn on the registration check.
 * The uploaded file is only read; it is never stored.
 */
class MasterlistController extends Controller
{
    private const UPDATE_FIELDS = ['full_name', 'last_name', 'first_name', 'course_id', 'course_code', 'year_level', 'section'];

    public function index(Request $request)
    {
        $request->validate([
            'academic_period_id' => 'nullable|uuid',
            'q' => 'nullable|string|max:100',
            'course_id' => 'nullable|uuid',
            'registered' => 'nullable|in:yes,no',
            'page' => 'nullable|integer|min:1',
        ]);

        $periods = AcademicPeriod::orderByDesc('academic_year_start')->orderBy('semester')->get(['id', 'academic_year_start', 'academic_year_end', 'semester', 'is_active']);
        $periodId = $request->academic_period_id
            ?: optional($periods->firstWhere('is_active', true))->id
            ?: optional($periods->first())->id;

        $base = DB::table('student_masterlist')
            ->leftJoin('users', function ($join) {
                $join->on('users.student_id', '=', 'student_masterlist.student_id')->where('users.role', 'student');
            })
            ->where('student_masterlist.academic_period_id', $periodId);

        $total = (clone $base)->count();
        $registered = (clone $base)->whereNotNull('users.id')->count();

        $query = (clone $base)
            ->when($request->q, function ($query, $search) {
                $like = '%' . mb_strtolower(trim($search)) . '%';
                $query->where(function ($inner) use ($like) {
                    $inner->whereRaw('LOWER(student_masterlist.full_name) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(student_masterlist.student_id) LIKE ?', [$like]);
                });
            })
            ->when($request->course_id, fn ($query, $courseId) => $query->where('student_masterlist.course_id', $courseId))
            ->when($request->registered === 'yes', fn ($query) => $query->whereNotNull('users.id'))
            ->when($request->registered === 'no', fn ($query) => $query->whereNull('users.id'))
            ->orderBy('student_masterlist.course_code')
            ->orderBy('student_masterlist.full_name')
            ->select([
                'student_masterlist.id', 'student_masterlist.student_id', 'student_masterlist.full_name',
                'student_masterlist.last_name', 'student_masterlist.first_name', 'student_masterlist.course_id', 'student_masterlist.course_code',
                'student_masterlist.year_level', 'student_masterlist.section', 'student_masterlist.updated_at',
                'users.id as user_id',
            ]);

        $page = $query->paginate(10);
        $page->getCollection()->transform(function ($row) {
            $row->registered = $row->user_id !== null;
            unset($row->user_id);
            return $row;
        });

        $imports = DB::table('masterlist_imports')
            ->leftJoin('users', 'users.id', '=', 'masterlist_imports.uploaded_by')
            ->where('masterlist_imports.academic_period_id', $periodId)
            ->orderByDesc('masterlist_imports.created_at')
            ->limit(5)
            ->get(['masterlist_imports.*', 'users.first_name as uploader_first_name', 'users.last_name as uploader_last_name']);

        $courses = DB::table('student_masterlist')
            ->where('academic_period_id', $periodId)
            ->whereNotNull('course_id')
            ->select('course_id', 'course_code', DB::raw('COUNT(*) as total'))
            ->groupBy('course_id', 'course_code')
            ->orderBy('course_code')
            ->get();

        $allCourses = Course::orderBy('code')->get(['id', 'code', 'name', 'is_active']);

        return response()->json([
            'success' => true,
            'data' => $page->items(),
            'meta' => [
                'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(),
                'total' => $page->total(), 'from' => $page->firstItem() ?? 0, 'to' => $page->lastItem() ?? 0,
            ],
            'period_id' => $periodId,
            'periods' => $periods,
            'summary' => ['total' => $total, 'registered' => $registered, 'not_registered' => $total - $registered],
            'courses' => $courses,
            'all_courses' => $allCourses,
            'imports' => $imports,
            'settings' => ['required' => Masterlist::required(), 'active_count' => Masterlist::activeCount()],
        ]);
    }

    // Reads the file and shows what an import would do, without saving anything.
    public function preview(Request $request)
    {
        [$period, $parsed, $fileName] = $this->readUpload($request);
        $existing = DB::table('student_masterlist')
            ->where('academic_period_id', $period->id)
            ->whereIn('student_id', array_column($parsed['entries'], 'student_id'))
            ->get()->keyBy('student_id');

        $counts = ['new' => 0, 'update' => 0, 'same' => 0];
        $entries = array_map(function ($entry) use ($existing, &$counts) {
            $old = $existing->get($entry['student_id']);
            $status = !$old ? 'new' : ($this->changed($old, $entry) ? 'update' : 'same');
            $counts[$status]++;
            return [
                'line' => $entry['line'], 'student_id' => $entry['student_id'], 'full_name' => $entry['full_name'],
                'last_name' => $entry['last_name'], 'course_code' => $entry['course_code'], 'new_course' => $entry['new_course'],
                'year_level' => $entry['year_level'], 'section' => $entry['section'], 'status' => $status, 'warning' => $entry['warning'],
            ];
        }, $parsed['entries']);

        return response()->json([
            'success' => true,
            'data' => [
                'file_name' => $fileName,
                'period' => $period,
                'summary' => [
                    'students' => count($entries), 'new' => $counts['new'], 'update' => $counts['update'], 'same' => $counts['same'],
                    'errors' => count($parsed['errors']), 'warnings' => count(array_filter($entries, fn ($entry) => $entry['warning'])),
                ],
                'new_courses' => $parsed['new_courses'],
                'entries' => $entries,
                'errors' => $parsed['errors'],
            ],
        ]);
    }

    public function import(Request $request)
    {
        [$period, $parsed, $fileName] = $this->readUpload($request);
        abort_if(!$parsed['entries'], 422, 'No students could be read from this file.');

        $result = DB::transaction(function () use ($period, $parsed, $fileName) {
            // Courses that are not in Course Management yet are added first.
            $newCourseIds = [];
            foreach ($parsed['new_courses'] as $course) {
                $newCourseIds[$course['code']] = Course::create(['code' => $course['code'], 'name' => mb_substr($course['name'], 0, 150), 'is_active' => true])->id;
            }

            $existing = DB::table('student_masterlist')
                ->where('academic_period_id', $period->id)
                ->whereIn('student_id', array_column($parsed['entries'], 'student_id'))
                ->get()->keyBy('student_id');

            $importId = (string) Str::uuid();
            $now = now();
            $added = 0;
            $updated = 0;
            $rows = [];
            foreach ($parsed['entries'] as $entry) {
                $entry['course_id'] = $entry['course_id'] ?: ($entry['course_code'] ? ($newCourseIds[$entry['course_code']] ?? null) : null);
                $old = $existing->get($entry['student_id']);
                if ($old && !$this->changed($old, $entry)) continue;
                $old ? $updated++ : $added++;
                $rows[] = [
                    'academic_period_id' => $period->id, 'student_id' => $entry['student_id'],
                    'full_name' => $entry['full_name'], 'last_name' => mb_substr($entry['last_name'], 0, 100),
                    'first_name' => $entry['first_name'] !== null ? mb_substr($entry['first_name'], 0, 150) : null,
                    'course_id' => $entry['course_id'], 'course_code' => $entry['course_code'],
                    'year_level' => $entry['year_level'], 'section' => $entry['section'],
                    'import_id' => $importId, 'created_at' => $now, 'updated_at' => $now,
                ];
            }
            foreach (array_chunk($rows, 500) as $chunk) {
                DB::table('student_masterlist')->upsert($chunk, ['academic_period_id', 'student_id'], array_merge(self::UPDATE_FIELDS, ['import_id', 'updated_at']));
            }

            DB::table('masterlist_imports')->insert([
                'id' => $importId, 'academic_period_id' => $period->id, 'file_name' => mb_substr($fileName, 0, 255),
                'uploaded_by' => auth()->id(), 'added_count' => $added, 'updated_count' => $updated,
                'skipped_count' => count($parsed['errors']), 'created_at' => $now, 'updated_at' => $now,
            ]);
            AuditLog::create([
                'user_id' => auth()->id(), 'action' => 'masterlist_imported',
                'description' => "Masterlist imported for {$this->periodLabel($period)}: {$added} added, {$updated} updated, " . count($parsed['errors']) . ' skipped',
                'ip_address' => request()->ip(),
            ]);

            return ['added' => $added, 'updated' => $updated, 'skipped' => count($parsed['errors']), 'new_courses' => array_keys($newCourseIds)];
        }, 3);

        NurseSync::changed('academic');

        return response()->json(['success' => true, 'data' => $result, 'message' => "Masterlist saved. {$result['added']} added, {$result['updated']} updated."]);
    }

    public function update(Request $request, $id)
    {
        $row = DB::table('student_masterlist')->where('id', $id)->first();
        abort_if(!$row, 404, 'This student is no longer on the masterlist.');

        $data = $request->validate([
            'student_id' => ['required', 'string', 'max:17', 'regex:' . Masterlist::ID_PATTERN],
            'last_name' => 'required|string|max:100',
            'first_name' => 'nullable|string|max:150',
            'course_id' => 'nullable|uuid',
            'year_level' => 'nullable|in:1st Year,2nd Year,3rd Year,4th Year,5th Year',
            'section' => 'nullable|string|max:20',
        ], [
            'student_id.regex' => 'Student ID must look like 2023-00000-BN-0.',
        ]);

        $studentId = strtoupper(preg_replace('/\s+/', '', trim($data['student_id'])));
        $duplicate = DB::table('student_masterlist')
            ->where('academic_period_id', $row->academic_period_id)
            ->where('student_id', $studentId)
            ->where('id', '!=', $id)
            ->exists();
        if ($duplicate) {
            throw ValidationException::withMessages(['student_id' => 'This Student ID is already on the masterlist for this academic period.']);
        }

        $course = !empty($data['course_id']) ? Course::find($data['course_id']) : null;
        if (!empty($data['course_id']) && !$course) {
            throw ValidationException::withMessages(['course_id' => 'Choose a valid course.']);
        }

        $lastName = trim($data['last_name']);
        $firstName = trim((string) ($data['first_name'] ?? ''));
        $fullName = mb_substr($firstName !== '' ? "{$lastName}, {$firstName}" : $lastName, 0, 255);
        $section = trim((string) ($data['section'] ?? ''));

        DB::table('student_masterlist')->where('id', $id)->update([
            'student_id' => $studentId,
            'full_name' => $fullName,
            'last_name' => mb_substr($lastName, 0, 100),
            'first_name' => $firstName !== '' ? mb_substr($firstName, 0, 150) : null,
            'course_id' => $course?->id,
            'course_code' => $course?->code,
            'year_level' => !empty($data['year_level']) ? $data['year_level'] : null,
            'section' => $section !== '' ? $section : null,
            'updated_at' => now(),
        ]);

        AuditLog::create([
            'user_id' => auth()->id(), 'action' => 'masterlist_student_updated',
            'description' => "Updated {$studentId} on the masterlist",
            'ip_address' => request()->ip(),
        ]);
        NurseSync::changed('academic');

        return response()->json(['success' => true, 'message' => 'Student updated on the masterlist.']);
    }

    public function destroy($id)
    {
        $row = DB::table('student_masterlist')->where('id', $id)->first();
        abort_if(!$row, 404, 'This student is no longer on the masterlist.');
        DB::table('student_masterlist')->where('id', $id)->delete();
        AuditLog::create([
            'user_id' => auth()->id(), 'action' => 'masterlist_student_removed',
            'description' => "Removed {$row->student_id} from the masterlist",
            'ip_address' => request()->ip(),
        ]);
        NurseSync::changed('academic');

        return response()->json(['success' => true, 'message' => 'Student removed from the masterlist.']);
    }

    public function clear(Request $request)
    {
        $data = $request->validate(['academic_period_id' => 'required|uuid']);
        $period = AcademicPeriod::findOrFail($data['academic_period_id']);
        $count = DB::table('student_masterlist')->where('academic_period_id', $period->id)->delete();
        AuditLog::create([
            'user_id' => auth()->id(), 'action' => 'masterlist_cleared',
            'description' => "Masterlist cleared for {$this->periodLabel($period)} ({$count} students)",
            'ip_address' => request()->ip(),
        ]);
        NurseSync::changed('academic');

        return response()->json(['success' => true, 'message' => "Masterlist cleared. {$count} students removed."]);
    }

    /** @return array{0: AcademicPeriod, 1: array, 2: string} */
    private function readUpload(Request $request): array
    {
        $request->validate([
            'academic_period_id' => 'required|uuid',
            'file' => 'required|file|max:5120',
        ], [
            'academic_period_id.required' => 'Choose an academic period.',
            'file.required' => 'Choose a file to import.',
            'file.max' => 'The file must be 5 MB or smaller.',
        ]);
        $period = AcademicPeriod::find($request->academic_period_id);
        if (!$period) throw ValidationException::withMessages(['academic_period_id' => 'Choose an academic period.']);

        $file = $request->file('file');
        $extension = strtolower($file->getClientOriginalExtension());
        if (!in_array($extension, ['xlsx', 'csv'], true)) {
            throw ValidationException::withMessages(['file' => 'Use an Excel (.xlsx) or CSV (.csv) file. Old .xls files must be saved again as .xlsx.']);
        }

        try {
            $rows = MasterlistReader::read($file->getRealPath(), $extension);
        } catch (\RuntimeException $e) {
            throw ValidationException::withMessages(['file' => $e->getMessage()]);
        }
        if (!$rows) throw ValidationException::withMessages(['file' => 'This file is empty.']);

        $fileName = preg_replace('/[^\pL\d .()_-]/u', '', $file->getClientOriginalName()) ?: 'masterlist';

        return [$period, Masterlist::parse($rows), $fileName];
    }

    private function changed(object $old, array $entry): bool
    {
        foreach (self::UPDATE_FIELDS as $field) {
            if ($field === 'course_id' && !$entry['course_id']) continue; // a course added during this import
            if ((string) ($old->{$field} ?? '') !== (string) ($entry[$field] ?? '')) return true;
        }
        return false;
    }

    private function periodLabel(AcademicPeriod $period): string
    {
        return "{$period->academic_year_start}-{$period->academic_year_end} {$period->semester}";
    }
}
