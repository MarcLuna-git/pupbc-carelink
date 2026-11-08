<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use App\Support\DatabaseSearch;
use App\Support\TimeGuard;
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
    // Plain-language errors for vital signs typed in the wrong format.
    private const VITAL_MESSAGES = [
        'vital_signs.bp.regex' => 'Blood pressure must look like 120/80.',
        'vital_signs.hr.digits_between' => 'Pulse rate must be a number.',
        'vital_signs.rr.digits_between' => 'Respiratory rate must be a number.',
        'vital_signs.o2_sat.digits_between' => 'Pulse oxygen rate must be a number.',
        'vital_signs.temp.regex' => 'Temperature must be a number like 36.5.',
    ];

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

    // Nurse accounts that can be named as the attending nurse on a consultation.
    public function nurses()
    {
        $nurses = \App\Models\User::where('role', 'nurse')
            ->where(fn ($query) => $query->whereNull('status')->orWhere('status', '!=', 'archived'))
            ->orderBy('last_name')->orderBy('first_name')
            ->get(['id', 'first_name', 'last_name']);

        return response()->json(['success' => true, 'data' => $nurses]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'user_id' => 'bail|required|uuid|exists:users,id',
            'appointment_id' => 'bail|required|uuid|exists:appointments,id',
            'appointment_checkin_id' => 'bail|required|uuid|exists:appointment_checkins,id',
            'chief_complaint' => 'required|string|max:2000',
            'vital_signs' => 'nullable|array:bp,hr,rr,temp,o2_sat',
            'vital_signs.bp' => ['nullable', 'regex:/^\d{2,3}\/\d{2,3}$/'], 'vital_signs.hr' => 'nullable|digits_between:1,3', 'vital_signs.rr' => 'nullable|digits_between:1,3', 'vital_signs.o2_sat' => 'nullable|digits_between:1,3', 'vital_signs.temp' => ['nullable', 'regex:/^\d{2}(\.\d)?$/'],
            'general_remarks' => 'nullable|string|max:5000',
            // Required parts of the clinic's consultation form (the rest stays optional).
            'history_present_illness' => 'required|string|max:2000',
            'nursing_assessment' => 'required|string|max:2000',
            'nursing_interventions' => 'required|string|max:2000',
            'treatment_plan' => 'nullable|string|max:2000',
            // The nurse who attended the patient; defaults to the signed-in nurse.
            'attending_nurse_id' => 'nullable|uuid|exists:users,id',
            'medical_certificate' => 'sometimes|boolean',
            'medical_certificate_ref' => 'nullable|string|max:191',
            // Optional Medical Liability Form: the activity the student declares they are fit to join.
            'liability_form' => 'sometimes|boolean',
            'liability_activity' => 'nullable|required_if:liability_form,true|string|max:191',
            // Optional Medical Certificate (OJT): the company where the student will do On the Job Training.
            'ojt_certificate' => 'sometimes|boolean',
            'ojt_certificate_ref' => 'nullable|string|max:191',
            'ojt_company' => 'nullable|required_if:ojt_certificate,true|string|max:191',
            // Optional Medical Certificate (Sick): days of medical attendance the illness needs.
            'sick_certificate' => 'sometimes|boolean',
            'sick_certificate_ref' => 'nullable|string|max:191',
            'sick_rest_days' => 'nullable|integer|min:1|max:365',
            'follow_up_required' => 'sometimes|boolean',
            'follow_up_date' => 'nullable|required_if:follow_up_required,true|date' . (TimeGuard::nursePortalBypassed() ? '' : '|after_or_equal:today'),
        ], [
            'chief_complaint.required' => 'Enter the chief complaint.',
            'history_present_illness.required' => 'Enter the history / present illness.',
            'nursing_assessment.required' => 'Enter the nursing assessment.',
            'nursing_interventions.required' => 'Enter the nursing interventions.',
            'liability_activity.required_if' => 'Enter the activity for the medical liability form.',
            'ojt_company.required_if' => 'Enter the company for the OJT medical certificate.',
        ], self::VITAL_MESSAGES);
        $attendingNurseId = $data['attending_nurse_id'] ?? null;
        unset($data['attending_nurse_id']);
        abort_if(
            $attendingNurseId && !\App\Models\User::where('role', 'nurse')->whereKey($attendingNurseId)->exists(),
            422,
            'The attending nurse must be a nurse account.'
        );
        $consultation = DB::transaction(function () use ($data, $request, $attendingNurseId) {
            \App\Services\ClinicQueue::lock();
            $student = \App\Models\User::where('role', 'student')->findOrFail($data['user_id']);
            $appointment = Appointment::findOrFail($data['appointment_id']);
            $checkin = \App\Models\AppointmentCheckin::findOrFail($data['appointment_checkin_id']);
            abort_unless($appointment->user_id === $student->id && $checkin->user_id === $student->id && $checkin->appointment_id === $appointment->id && !$checkin->is_walk_in, 422, 'Student, appointment and check-in must belong to the same visit.');
            abort_if(Consultation::where('appointment_checkin_id', $checkin->id)->exists(), 409, 'This visit already has a consultation.');
            // The visit's "Save progress" draft is done once the consultation is on record.
            DB::table('consultation_drafts')->where('checkin_id', $checkin->id)->delete();
            \App\Services\NurseVisitClaim::acquire($request, $checkin->id);
            abort_unless($appointment->status === 'approved' && in_array($checkin->status, ['called', 'serving']), 422, 'Call this patient before recording the consultation.');
            $consultation = Consultation::create(array_merge($data, ['nurse_id' => $attendingNurseId ?: auth()->id(), 'status' => 'completed']));
            $appointment->update(['status' => 'completed']);
            $checkin->update(['status' => 'completed']);
            DB::table('nurse_visit_claims')->where('checkin_id', $checkin->id)->delete();
            Notification::create(['user_id' => $student->id, 'type' => 'consultation_completed', 'title' => 'Consultation Recorded', 'message' => 'Your consultation has been recorded.']);
            AuditLog::create(['user_id' => auth()->id(), 'action' => 'consultation_created', 'description' => 'Consultation recorded for visit ' . $checkin->id, 'ip_address' => request()->ip()]);
            return $consultation;
        }, 3);
        Cache::forget('nurse_dashboard_stats');
        return response()->json(['success' => true, 'data' => $consultation->fresh(), 'message' => 'Consultation saved'], 201);
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
            'chief_complaint' => 'sometimes|required|string|max:2000', 'vital_signs' => 'nullable|array:bp,hr,rr,temp,o2_sat', 'vital_signs.bp' => ['nullable', 'regex:/^\d{2,3}\/\d{2,3}$/'], 'vital_signs.hr' => 'nullable|digits_between:1,3', 'vital_signs.rr' => 'nullable|digits_between:1,3', 'vital_signs.o2_sat' => 'nullable|digits_between:1,3', 'vital_signs.temp' => ['nullable', 'regex:/^\d{2}(\.\d)?$/'],
            'general_remarks' => 'nullable|string|max:5000', 'medical_certificate' => 'sometimes|boolean', 'medical_certificate_ref' => 'nullable|string|max:191',
            'liability_form' => 'sometimes|boolean', 'liability_activity' => 'nullable|string|max:191',
            'ojt_certificate' => 'sometimes|boolean', 'ojt_certificate_ref' => 'nullable|string|max:191', 'ojt_company' => 'nullable|string|max:191',
            'sick_certificate' => 'sometimes|boolean', 'sick_certificate_ref' => 'nullable|string|max:191', 'sick_rest_days' => 'nullable|integer|min:1|max:365',
            'history_present_illness' => 'sometimes|required|string|max:2000', 'nursing_assessment' => 'sometimes|required|string|max:2000',
            'nursing_interventions' => 'sometimes|required|string|max:2000', 'treatment_plan' => 'nullable|string|max:2000',
            'follow_up_required' => 'sometimes|boolean', 'follow_up_date' => 'nullable|date',
        ], self::VITAL_MESSAGES));
        return response()->json(['success' => true, 'data' => $consultation->fresh(), 'message' => 'Consultation updated']);
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
