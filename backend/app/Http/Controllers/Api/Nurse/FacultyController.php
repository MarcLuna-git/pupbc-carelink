<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\FacultyConsultation;
use App\Models\FacultyDispensing;
use App\Models\FacultyMember;
use App\Models\Medicine;
use App\Support\DatabaseSearch;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/*
 * The Faculty page: a directory of faculty and staff, and the medicines the clinic dispenses to them.
 * Dispensing takes the stock out of the inventory the same way as for a student (first expiry, first out).
 */
class FacultyController extends Controller
{
    private const FORMAT_MESSAGES = [
        'full_name.regex' => 'Name can only contain letters, spaces, periods, hyphens and apostrophes.',
        'phone.regex' => 'Use +639XXXXXXXXX.',
    ];

    private function rules(bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes|required';
        return [
            'full_name' => [...explode('|', "$required|string|max:150"), 'regex:/^[\pL\s\-\'.]+$/u'],
            'faculty_type' => ['sometimes', 'required', Rule::in(FacultyMember::TYPES)],
            'course' => 'nullable|string|max:50',
            'designation' => 'nullable|string|max:100',
            'department' => 'nullable|string|max:150',
            'email' => 'nullable|email|max:150',
            'phone' => ['nullable', 'string', 'regex:/^\+639\d{9}$/'],
            'notes' => 'nullable|string|max:500',
            'status' => ['sometimes', 'required', Rule::in(FacultyMember::STATUSES)],
        ];
    }

    // The same name twice is almost certainly a duplicate entry.
    private function ensureNotDuplicate(string $name, ?string $ignoreId = null): void
    {
        $query = FacultyMember::whereRaw('LOWER(full_name) = ?', [strtolower(trim($name))]);
        if ($ignoreId) {
            $query->where('id', '!=', $ignoreId);
        }
        if ($query->exists()) {
            throw ValidationException::withMessages(['full_name' => 'This faculty member is already in the directory.']);
        }
    }

    private function clean(array $data): array
    {
        foreach (['full_name', 'course', 'designation', 'department', 'email', 'phone', 'notes'] as $key) {
            if (array_key_exists($key, $data)) {
                $data[$key] = is_string($data[$key]) && trim($data[$key]) !== '' ? trim($data[$key]) : null;
            }
        }
        return $data;
    }

    public function index(Request $request)
    {
        $query = FacultyMember::query();

        if ($request->filled('search')) {
            $term = '%' . trim($request->search) . '%';
            $query->where(function ($q) use ($term) {
                $q->where('full_name', DatabaseSearch::like($q), $term)->orWhere('email', DatabaseSearch::like($q), $term);
            });
        }
        if ($request->filled('type')) {
            $query->where('faculty_type', $request->type);
        }
        if ($request->filled('course')) {
            $query->where('course', $request->course);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $perPage = min(max((int) $request->input('per_page', 10), 1), 100);

        return response()->json([
            'success' => true,
            'data' => $query->orderBy('full_name')->orderBy('id')->paginate($perPage),
            // The three cards at the top: everyone in the directory, whatever the filters.
            'stats' => [
                'total' => FacultyMember::count(),
                'full_time' => FacultyMember::where('faculty_type', 'full_time')->count(),
                'part_time' => FacultyMember::where('faculty_type', 'part_time')->count(),
            ],
            // Programs in use, for the course filter.
            'courses' => FacultyMember::whereNotNull('course')->distinct()->orderBy('course')->pluck('course'),
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->clean($request->validate($this->rules(true), self::FORMAT_MESSAGES));
        $this->ensureNotDuplicate($data['full_name']);

        $faculty = FacultyMember::create(array_merge(['faculty_type' => 'full_time', 'status' => 'active'], $data, ['created_by' => auth()->id()]));

        return response()->json(['success' => true, 'message' => 'Faculty member added.', 'data' => $faculty->fresh()], 201);
    }

    public function show($id)
    {
        $faculty = FacultyMember::findOrFail($id);

        return response()->json(['success' => true, 'data' => $faculty, 'recent_dispensings' => $faculty->dispensings()
            ->with('dispenser:id,first_name,last_name')->latest()->limit(5)->get(), 'dispensing_count' => $faculty->dispensings()->count(),
            'consultations' => $faculty->consultations()->with('consultant:id,first_name,last_name')->latest()->limit(10)->get(),
            'consultation_count' => $faculty->consultations()->count()]);
    }

    /* Record a clinic consultation for a faculty member. */
    public function consult(Request $request, $id)
    {
        $data = $request->validate([
            'chief_complaint' => 'required|string|max:500',
            'blood_pressure' => ['nullable', 'string', 'max:20', 'regex:/^\d{2,3}\/\d{2,3}$/'],
            'temperature' => 'nullable|numeric|between:30,45',
            'pulse_rate' => 'nullable|integer|between:20,250',
            'assessment' => 'nullable|string|max:2000',
            'intervention' => 'nullable|string|max:2000',
            'notes' => 'nullable|string|max:2000',
        ], ['blood_pressure.regex' => 'Enter the blood pressure like 120/80.']);
        $faculty = FacultyMember::findOrFail($id);
        abort_unless($faculty->status === 'active', 422, 'This faculty member is inactive. Make them active before recording a consultation.');
        $data = array_map(fn ($value) => is_string($value) ? (trim($value) === '' ? null : trim($value)) : $value, $data);
        abort_if(empty($data['chief_complaint']), 422, 'Enter the chief complaint.');

        $consultation = FacultyConsultation::create($data + ['faculty_member_id' => $faculty->id, 'consulted_by' => auth()->id()]);

        AuditLog::create([
            'user_id' => auth()->id(),
            'action' => 'faculty_consulted',
            'description' => "Recorded a consultation for faculty member {$faculty->id}",
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => "Consultation saved for {$faculty->full_name}.",
            'data' => $consultation->load('consultant:id,first_name,last_name'),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $faculty = FacultyMember::findOrFail($id);
        $data = $this->clean($request->validate($this->rules(false), self::FORMAT_MESSAGES));
        $this->ensureNotDuplicate($data['full_name'] ?? $faculty->full_name, $faculty->id);

        $faculty->update($data);

        return response()->json(['success' => true, 'message' => 'Faculty member updated.', 'data' => $faculty->fresh()]);
    }

    public function destroy($id)
    {
        FacultyMember::findOrFail($id)->delete();

        return response()->json(['success' => true, 'message' => 'Faculty member deleted.']);
    }

    /* Give a medicine to a faculty member: takes it out of the stock and records it. */
    public function dispense(Request $request, $id)
    {
        $data = $request->validate([
            'medicine_id' => 'required|uuid|exists:medicines,id,deleted_at,NULL',
            'quantity' => 'required|integer|min:1|max:100000',
            'reason' => 'required|string|max:500',
        ]);
        $faculty = FacultyMember::findOrFail($id);
        abort_unless($faculty->status === 'active', 422, 'This faculty member is inactive. Make them active before dispensing.');
        $reason = trim($data['reason']);
        abort_if($reason === '', 422, 'Enter the reason for dispensing.');

        [$medicine, $allocations] = app(MedicineController::class)->dispenseToFaculty($data['medicine_id'], (int) $data['quantity'], $reason, $faculty->id);

        $dispensing = FacultyDispensing::create([
            'faculty_member_id' => $faculty->id,
            'medicine_id' => $medicine->id,
            'medicine_name' => $medicine->name,
            'quantity' => (int) $data['quantity'],
            'unit' => $medicine->unit,
            'reason' => $reason,
            'dispensed_by' => auth()->id(),
        ]);

        AuditLog::create([
            'user_id' => auth()->id(),
            'action' => 'faculty_dispensed',
            'description' => "Dispensed {$dispensing->quantity} {$dispensing->unit} of {$medicine->name} to faculty member {$faculty->id}",
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => "Dispensed {$dispensing->quantity} {$dispensing->unit} of {$medicine->name} to {$faculty->full_name}.",
            'data' => $dispensing->load('dispenser:id,first_name,last_name'),
            'medicine' => ['id' => $medicine->id, 'quantity' => $medicine->quantity, 'unit' => $medicine->unit],
            'allocations' => $allocations,
        ], 201);
    }

    /*
     * Dispensing History, newest first.
     *   faculty_id – one faculty member
     *   from, to   – dates, inclusive, in clinic time (Asia/Manila)
     */
    public function dispensings(Request $request)
    {
        $request->validate([
            'faculty_id' => 'nullable|uuid',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $query = FacultyDispensing::with(['faculty:id,full_name,course', 'dispenser:id,first_name,last_name']);
        if ($request->filled('faculty_id')) {
            $query->where('faculty_member_id', $request->faculty_id);
        }
        // Clinic days, turned into the timezone the timestamps are stored in.
        $zone = config('app.timezone');
        if ($request->filled('from')) {
            $query->where('created_at', '>=', Carbon::parse($request->from, 'Asia/Manila')->startOfDay()->setTimezone($zone));
        }
        if ($request->filled('to')) {
            $query->where('created_at', '<=', Carbon::parse($request->to, 'Asia/Manila')->endOfDay()->setTimezone($zone));
        }

        return response()->json([
            'success' => true,
            'data' => $query->orderByDesc('created_at')->orderByDesc('id')->paginate(min(max((int) $request->input('per_page', 10), 1), 100)),
        ]);
    }
}
