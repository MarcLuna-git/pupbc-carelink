<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use App\Services\ClinicQueue;
use App\Support\DatabaseSearch;
use App\Models\User;
use App\Models\Appointment;
use App\Models\Notification;
use App\Models\AuditLog;
use App\Models\HealthProfile;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query()->with('studentProfile')->where('role', 'student');

        $tokens = array_slice(preg_split('/[\s,]+/u', (string) $request->input('search', ''), -1, PREG_SPLIT_NO_EMPTY) ?: [], 0, 8);
        foreach ($tokens as $token) {
            $query->where(function ($q) use ($token) {
                $pattern = "%{$token}%";
                $operator = DatabaseSearch::like($q);
                $q->where('first_name', $operator, $pattern)
                  ->orWhere('middle_name', $operator, $pattern)
                  ->orWhere('last_name', $operator, $pattern)
                  ->orWhere('student_id', $operator, $pattern);
            });
        }

        if ($request->course) {
            $query->whereHas('studentProfile', fn($q) => $q->where('course', $request->course));
        }

        foreach (['year', 'section'] as $field) {
            if ($request->filled($field)) {
                $query->whereHas('studentProfile', fn($q) => $q->where($field, $request->input($field)));
            }
        }

        if ($request->filled('status')) {
            $status = $request->input('status');
            if ($status === 'active') {
                $query->where(fn($q) => $q->whereNull('status')->orWhere('status', 'pending'));
            } else {
                $query->where('status', $status);
                if ($status === 'archived') {
                    $query->withTrashed();
                }
            }
        }

        // Registered between the From / To dates (inclusive, clinic time).
        $dates = $request->validate([
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to' => 'nullable|date_format:Y-m-d|after_or_equal:date_from',
        ]);
        if (!empty($dates['date_from'])) {
            $query->where('created_at', '>=', Carbon::parse($dates['date_from'], 'Asia/Manila')->startOfDay());
        }
        if (!empty($dates['date_to'])) {
            $query->where('created_at', '<=', Carbon::parse($dates['date_to'], 'Asia/Manila')->endOfDay());
        }

        $students = $query->orderBy('last_name')->paginate(20);

        return response()->json(['success' => true, 'data' => $students]);
    }

    public function search(Request $request)
    {
        $students = User::where('role', 'student')
            ->where(function ($q) use ($request) {
                $q->where('first_name', DatabaseSearch::like($q), "%{$request->q}%")
                  ->orWhere('last_name', DatabaseSearch::like($q), "%{$request->q}%")
                  ->orWhere('student_id', DatabaseSearch::like($q), "%{$request->q}%");
            })
            ->limit(10)->get();

        return response()->json(['success' => true, 'data' => $students]);
    }

    public function show($id)
    {
        $student = User::withTrashed()->where('role', 'student')
            ->with(['studentProfile', 'healthProfile'])
            ->findOrFail($id);

        return response()->json(['success' => true, 'data' => $student]);
    }

    public function archive(Request $request, $id)
    {
        $data = $request->validate(['reason' => 'required|string|max:500']);

        return DB::transaction(function () use ($data, $id) {
            ClinicQueue::lock();
            $student = User::where('role', 'student')->lockForUpdate()->findOrFail($id);
            abort_unless($student->status !== 'archived' && !$student->trashed(), 422, 'Student is already archived.');

            abort_if(Appointment::where('user_id', $student->id)
                ->whereIn('status', ['pending', 'approved'])
                ->whereDate('appointment_date', '>=', today('Asia/Manila')->toDateString())
                ->exists(), 422, 'Student cannot be archived with an upcoming appointment.');

            abort_if(ClinicQueue::ordered()
                ->where('appointment_checkins.user_id', $student->id)
                ->whereIn('appointment_checkins.status', ['waiting', 'called', 'serving', 'skipped', 'on_hold'])
                ->exists(), 422, 'Student cannot be archived with an active queue entry.');

            $student->update([
                'status' => 'archived',
                'archive_reason' => $data['reason'],
                'archived_by' => auth()->id(),
                'archived_at' => now(),
            ]);
            Notification::create([
                'user_id' => $student->id,
                'type' => 'student_archived',
                'title' => 'Student Account Archived',
                'message' => 'Your student account was archived: ' . $data['reason'],
                'data' => ['reason' => $data['reason']],
            ]);
            $student->delete();

            return response()->json(['success' => true, 'message' => 'Student archived.']);
        }, 3);
    }

    public function restore($id)
    {
        return DB::transaction(function () use ($id) {
            $student = User::withTrashed()->where('role', 'student')->lockForUpdate()->findOrFail($id);
            abort_unless($student->status === 'archived' || $student->trashed(), 422, 'Student is not archived.');
            $student->restore();
            $student->update([
                'status' => null,
                'archive_reason' => null,
                'archived_by' => null,
                'archived_at' => null,
            ]);

            return response()->json(['success' => true, 'message' => 'Student restored.', 'data' => $student->fresh()]);
        }, 3);
    }

    /*
     * Delete a student for good, with the admin (Developer Tools) password.
     * Removes the account and every record tied to it: profiles, appointments,
     * check-ins, consultations, certificates, QR code, notifications and uploaded
     * files. Clinic records that only point at the student (medicine stock history)
     * stay and lose the link. One audit line under the nurse keeps who did it.
     */
    public function destroy(Request $request, $id)
    {
        $data = $request->validate(['password' => 'required|string|max:255'], [
            'password.required' => 'Enter the admin password.',
        ]);

        $adminPassword = (string) config('dev_tools.password');
        if ($adminPassword === '' || !hash_equals($adminPassword, (string) $data['password'])) {
            return response()->json([
                'success' => false,
                'message' => 'Incorrect admin password.',
                'errors' => ['password' => ['Incorrect admin password.']],
            ], 422);
        }

        $files = [];
        $deleted = DB::transaction(function () use ($id, &$files) {
            ClinicQueue::lock();
            $student = User::withTrashed()->where('role', 'student')->lockForUpdate()->findOrFail($id);

            abort_if(ClinicQueue::ordered()
                ->where('appointment_checkins.user_id', $student->id)
                ->whereIn('appointment_checkins.status', ['waiting', 'called', 'serving'])
                ->exists(), 422, 'This student is in the clinic queue right now. Finish or close the visit first.');

            $files = DB::table('student_attachments')->where('user_id', $student->id)->pluck('path')->filter()->all();

            $checkinIds = DB::table('appointment_checkins')->where('user_id', $student->id)->pluck('id');
            DB::table('nurse_visit_claims')->whereIn('checkin_id', $checkinIds)->delete();
            // Soft-deleting models: remove the rows for real. The rest go with the
            // user row (foreign keys with cascade).
            \App\Models\Consultation::withTrashed()->where('user_id', $student->id)->forceDelete();
            Appointment::withTrashed()->where('user_id', $student->id)->forceDelete();
            DB::table('appointment_checkins')->where('user_id', $student->id)->delete();

            $label = trim("{$student->first_name} {$student->last_name}") . " ({$student->student_id})";
            $student->forceDelete();

            AuditLog::create([
                'user_id' => auth()->id(),
                'action' => 'student_deleted',
                'description' => "Student deleted with all records: {$label}",
                'ip_address' => request()->ip(),
            ]);

            return $label;
        }, 3);

        // Files are removed only after the database delete is saved.
        if ($files) {
            \Illuminate\Support\Facades\Storage::disk('local')->delete($files);
        }
        \Illuminate\Support\Facades\Cache::forget('nurse_dashboard_stats');

        return response()->json(['success' => true, 'message' => "Deleted {$deleted} and all their records."]);
    }

    public function healthProfile($id)
    {
        $student = User::withTrashed()->where('role', 'student')->with('healthProfile')->findOrFail($id);
        return response()->json(['success' => true, 'data' => $student->healthProfile]);
    }

    public function updateMedicalRecord(Request $request, $id)
    {
        $data = $request->validate([
            'medical_history' => 'nullable|array',
            'medical_history.*' => 'string|max:255',
            'medications' => 'nullable|string|max:5000',
        ]);

        return DB::transaction(function () use ($data, $id) {
            $student = User::where('role', 'student')->findOrFail($id);
            $profile = HealthProfile::firstOrNew(['user_id' => $student->id]);
            $before = [
                'medical_history' => $profile->medical_history,
                'medications' => $profile->medications,
            ];
            $profile->fill($data);
            $profile->save();

            AuditLog::create([
                'user_id' => auth()->id(),
                'action' => 'medical_record_updated',
                'description' => 'Updated medical history and/or medications for student ' . $student->id . ' from ' . json_encode($before) . ' to ' . json_encode([
                    'medical_history' => $profile->medical_history,
                    'medications' => $profile->medications,
                ]),
                'ip_address' => request()->ip(),
            ]);

            return response()->json(['success' => true, 'data' => $profile->fresh(), 'message' => 'Medical record updated.']);
        }, 3);
    }

    public function appointments($id)
    {
        $appointments = \App\Models\Appointment::where('user_id', $id)
            ->orderBy('appointment_date', 'desc')->get();
        return response()->json(['success' => true, 'data' => $appointments]);
    }

    public function consultations($id)
    {
        $consultations = \App\Models\Consultation::where('user_id', $id)
            ->with('nurse:id,first_name,last_name')
            ->orderBy('created_at', 'desc')->get();
        return response()->json(['success' => true, 'data' => $consultations]);
    }

    public function emergencyEncounters($id)
    {
        $encounters = \App\Models\EmergencyEncounter::with('nurse:id,first_name,last_name')
            ->where('user_id', $id)->latest('incident_datetime')->get();
        return response()->json(['success' => true, 'data' => $encounters]);
    }

    public function clinicHistory($id)
    {
        User::withTrashed()->where('role', 'student')->findOrFail($id);
        return response()->json(['success' => true, 'data' => app(\App\Services\ClinicHistory::class)->forStudent($id)]);
    }
}
