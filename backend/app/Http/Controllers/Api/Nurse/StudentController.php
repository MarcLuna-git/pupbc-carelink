<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use App\Support\DatabaseSearch;
use App\Models\User;
use App\Models\Appointment;
use App\Models\Notification;
use App\Models\AuditLog;
use App\Models\HealthProfile;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query()->with('studentProfile')->where('role', 'student');

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('first_name', DatabaseSearch::like($q), "%{$request->search}%")
                  ->orWhere('last_name', DatabaseSearch::like($q), "%{$request->search}%")
                  ->orWhere('student_id', DatabaseSearch::like($q), "%{$request->search}%");
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
            $query->where('status', $request->input('status'));
            if ($request->input('status') === 'archived') {
                $query->withTrashed();
            }
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
            $student = User::where('role', 'student')->lockForUpdate()->findOrFail($id);
            abort_unless($student->status !== 'archived' && !$student->trashed(), 422, 'Student is already archived.');

            abort_if(Appointment::where('user_id', $student->id)
                ->where('status', 'approved')
                ->whereDate('appointment_date', '>=', today('Asia/Manila')->toDateString())
                ->exists(), 422, 'Student cannot be archived with a future approved appointment.');

            $pending = Appointment::where('user_id', $student->id)
                ->where('status', 'pending')
                ->whereDate('appointment_date', '>=', today('Asia/Manila')->toDateString())
                ->lockForUpdate()
                ->get();

            foreach ($pending as $appointment) {
                $appointment->update([
                    'status' => 'cancelled',
                    'cancellation_reason' => $data['reason'],
                    'cancelled_by' => auth()->id(),
                    'cancelled_at' => now(),
                ]);
                Notification::create([
                    'user_id' => $student->id,
                    'type' => 'appointment_cancelled',
                    'title' => 'Appointment Cancelled',
                    'message' => 'Your appointment was cancelled because your student account was archived: ' . $data['reason'],
                    'data' => ['appointment_id' => $appointment->id],
                ]);
                app(\App\Services\StudentAppointmentMail::class)->afterCommit($appointment);
            }

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
