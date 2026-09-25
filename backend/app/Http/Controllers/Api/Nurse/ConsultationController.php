<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use App\Support\DatabaseSearch;
use App\Models\Consultation;
use App\Models\Appointment;
use App\Models\Notification;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Carbon\Carbon;

class ConsultationController extends Controller
{
    public function index(Request $request)
    {
        $query = Consultation::with(['user:id,student_id,first_name,last_name', 'nurse:id,first_name,last_name'])
            ->when($request->date, fn($q) => $q->whereDate('created_at', $request->date))
            ->when($request->search, function($q) use ($request) {
                $q->whereHas('user', fn($q) => 
                    $q->where('first_name', DatabaseSearch::like($q), "%{$request->search}%")
                      ->orWhere('last_name', DatabaseSearch::like($q), "%{$request->search}%")
                      ->orWhere('student_id', DatabaseSearch::like($q), "%{$request->search}%")
                );
            })
            ->orderBy('created_at', 'desc');

        return response()->json(['success' => true, 'data' => $query->paginate(20)]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'user_id' => 'bail|required|uuid|exists:users,id',
            'appointment_id' => 'bail|required|uuid|exists:appointments,id',
            'appointment_checkin_id' => 'bail|required|uuid|exists:appointment_checkins,id',
            'chief_complaint' => 'required|string|max:2000',
            'vital_signs' => 'nullable|array:bp,hr,rr,temp,o2_sat',
            'vital_signs.*' => 'nullable|string|max:50',
            'general_remarks' => 'nullable|string|max:5000',
            'medical_certificate' => 'sometimes|boolean',
            'medical_certificate_ref' => 'nullable|string|max:191',
            'follow_up_required' => 'sometimes|boolean',
            'follow_up_date' => 'nullable|required_if:follow_up_required,true|date|after_or_equal:today',
        ]);
        $consultation = DB::transaction(function () use ($data) {
            \App\Services\ClinicQueue::lock();
            $student = \App\Models\User::where('role', 'student')->findOrFail($data['user_id']);
            $appointment = Appointment::findOrFail($data['appointment_id']);
            $checkin = \App\Models\AppointmentCheckin::findOrFail($data['appointment_checkin_id']);
            abort_unless($appointment->user_id === $student->id && $checkin->user_id === $student->id && $checkin->appointment_id === $appointment->id && !$checkin->is_walk_in, 422, 'Student, appointment and check-in must belong to the same visit.');
            abort_if(Consultation::where('appointment_checkin_id', $checkin->id)->exists(), 409, 'This visit already has a consultation.');
            abort_unless($appointment->status === 'approved' && $checkin->status === 'serving', 422, 'Call this patient before recording the consultation.');
            $consultation = Consultation::create(array_merge($data, ['nurse_id' => auth()->id(), 'status' => 'completed']));
            $appointment->update(['status' => 'completed']);
            $checkin->update(['status' => 'completed']);
            Notification::create(['user_id' => $student->id, 'type' => 'consultation_completed', 'title' => 'Consultation Recorded', 'message' => 'Your consultation has been recorded.']);
            AuditLog::create(['user_id' => auth()->id(), 'action' => 'consultation_created', 'description' => 'Consultation recorded for visit ' . $checkin->id, 'ip_address' => request()->ip()]);
            return $consultation;
        }, 3);
        Cache::forget('nurse_dashboard_stats');
        return response()->json(['success' => true, 'data' => $consultation, 'message' => 'Consultation saved'], 201);
    }

    public function show($id)
    {
        $consultation = Consultation::with(['user.studentProfile', 'user.healthProfile', 'nurse', 'appointment'])->findOrFail($id);

        AuditLog::create([
            'user_id' => auth()->id(),
            'action' => 'consultation_viewed',
            'description' => "Viewed consultation record {$id}",
            'ip_address' => request()->ip()
        ]);

        return response()->json(['success' => true, 'data' => $consultation]);
    }

    public function update(Request $request, $id)
    {
        $consultation = Consultation::findOrFail($id);
        abort_unless($consultation->status !== 'completed', 422, 'Completed consultations are read-only.');
        $consultation->update($request->validate([
            'chief_complaint' => 'sometimes|required|string|max:2000', 'vital_signs' => 'nullable|array:bp,hr,rr,temp,o2_sat', 'vital_signs.*' => 'nullable|string|max:50',
            'general_remarks' => 'nullable|string|max:5000', 'medical_certificate' => 'sometimes|boolean', 'medical_certificate_ref' => 'nullable|string|max:191',
            'follow_up_required' => 'sometimes|boolean', 'follow_up_date' => 'nullable|date',
        ]));
        return response()->json(['success' => true, 'data' => $consultation, 'message' => 'Consultation updated']);
    }

    public function todayConsultations()
    {
        $consultations = Consultation::with('user:id,first_name,last_name,student_id')
            ->whereDate('created_at', Carbon::today())->get();
        return response()->json(['success' => true, 'data' => $consultations]);
    }

    public function filterByDate($date)
    {
        $consultations = Consultation::with('user:id,first_name,last_name,student_id')
            ->whereDate('created_at', $date)->get();
        return response()->json(['success' => true, 'data' => $consultations]);
    }
}