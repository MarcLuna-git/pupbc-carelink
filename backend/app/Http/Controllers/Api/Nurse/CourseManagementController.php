<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use App\Models\AcademicPeriod;
use App\Models\Course;
use App\Models\CourseSection;
use App\Models\StudentEnrollment;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CourseManagementController extends Controller
{
    public function periods()
    {
        return response()->json(['success' => true, 'data' => AcademicPeriod::with('sections.course')->orderByDesc('academic_year_start')->orderBy('semester')->get()]);
    }

    public function storePeriod(Request $request)
    {
        $data = $request->validate([
            'academic_year_start' => 'required|integer|min:2000|max:2100',
            'academic_year_end' => 'required|integer|gte:academic_year_start|max:2101',
            'semester' => 'required|string|max:30',
            'is_active' => 'sometimes|boolean',
        ]);
        return response()->json(['success' => true, 'data' => AcademicPeriod::create($data)], 201);
    }

    public function updatePeriod(Request $request, $id)
    {
        $period = AcademicPeriod::findOrFail($id);
        $period->update($request->validate([
            'academic_year_start' => 'sometimes|integer|min:2000|max:2100',
            'academic_year_end' => 'sometimes|integer|gte:academic_year_start|max:2101',
            'semester' => 'sometimes|string|max:30',
            'is_active' => 'sometimes|boolean',
        ]));
        return response()->json(['success' => true, 'data' => $period->fresh()]);
    }

    public function courses()
    {
        return response()->json(['success' => true, 'data' => Course::withTrashed()->with('sections.academicPeriod')->orderBy('code')->get()]);
    }

    public function storeCourse(Request $request)
    {
        $data = $request->validate(['code' => 'required|string|max:50|unique:courses,code', 'name' => 'required|string|max:150', 'is_active' => 'sometimes|boolean']);
        return response()->json(['success' => true, 'data' => Course::create($data)], 201);
    }

    public function updateCourse(Request $request, $id)
    {
        $course = Course::findOrFail($id);
        $data = $request->validate(['code' => 'sometimes|string|max:50|unique:courses,code,' . $course->id, 'name' => 'sometimes|string|max:150', 'is_active' => 'sometimes|boolean']);
        return DB::transaction(function () use ($course, $data) {
            $oldCode = $course->code;
            $course->update($data);
            if (isset($data['code']) && $data['code'] !== $oldCode) {
                User::where('course', $oldCode)->update(['course' => $data['code']]);
                StudentProfile::where('course', $oldCode)->update(['course' => $data['code']]);
            }
            return response()->json(['success' => true, 'data' => $course->fresh()]);
        }, 3);
    }

    public function sections(Request $request)
    {
        $sections = CourseSection::with(['course', 'academicPeriod'])
            ->when($request->academic_period_id, function ($query) use ($request) { $query->where('academic_period_id', $request->academic_period_id); })
            ->when($request->course_id, function ($query) use ($request) { $query->where('course_id', $request->course_id); })
            ->orderBy('year_level')->orderBy('section_code')->get();
        return response()->json(['success' => true, 'data' => $sections]);
    }

    public function storeSection(Request $request)
    {
        $data = $request->validate([
            'academic_period_id' => 'bail|required|uuid|exists:academic_periods,id',
            'course_id' => 'bail|required|uuid|exists:courses,id',
            'year_level' => 'required|string|max:30',
            'section_code' => 'required|string|max:30',
            'is_active' => 'sometimes|boolean',
        ]);
        return response()->json(['success' => true, 'data' => CourseSection::create($data)], 201);
    }

    public function updateSection(Request $request, $id)
    {
        $section = CourseSection::findOrFail($id);
        $section->update($request->validate([
            'academic_period_id' => 'bail|sometimes|uuid|exists:academic_periods,id',
            'course_id' => 'bail|sometimes|uuid|exists:courses,id',
            'year_level' => 'sometimes|string|max:30',
            'section_code' => 'sometimes|string|max:30',
            'is_active' => 'sometimes|boolean',
        ]));
        return response()->json(['success' => true, 'data' => $section->fresh()]);
    }

    public function enroll(Request $request)
    {
        $data = $request->validate([
            'user_id' => 'bail|required|uuid|exists:users,id',
            'course_section_id' => 'bail|required|uuid|exists:course_sections,id',
            'status' => 'sometimes|string|in:enrolled,completed,withdrawn',
            'enrolled_at' => 'nullable|date',
        ]);
        abort_unless(User::where('id', $data['user_id'])->where('role', 'student')->exists(), 422, 'Only student accounts can be enrolled.');
        return response()->json(['success' => true, 'data' => StudentEnrollment::updateOrCreate(
            ['user_id' => $data['user_id'], 'course_section_id' => $data['course_section_id']],
            ['status' => $data['status'] ?? 'enrolled', 'enrolled_at' => $data['enrolled_at'] ?? today()]
        )], 201);
    }
}