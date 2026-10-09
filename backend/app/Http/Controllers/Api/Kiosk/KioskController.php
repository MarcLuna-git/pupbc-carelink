<?php
namespace App\Http\Controllers\Api\Kiosk;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\AppointmentCheckin;
use App\Models\AppointmentSlot;
use App\Services\AppointmentExpiry;
use App\Services\ClinicQueue;
use App\Services\KioskIdentity;
use App\Services\NurseVisitClaim;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;

class KioskController extends Controller
{
    public function availableSlots(Request $request)
    {
        $request->validate(['date' => 'required|date']);
        return response()->json(['success' => true, 'data' => ['date' => $request->date, 'slots' => AppointmentSlot::getAvailableSlots($request->date)]]);
    }
    public function lookup(Request $request)
    {
        $student = KioskIdentity::student($request);
        $appointment = KioskIdentity::appointment($student);
        $checkin = AppointmentCheckin::where('appointment_id', $appointment->id)->where('is_walk_in', false)->first();
        $expiryService = app(AppointmentExpiry::class);

        return response()->json(['success' => true, 'data' => [
            'user' => $student->only(['student_id', 'first_name', 'last_name']),
            'appointment' => [
                'service' => $appointment->service,
                'appointment_date' => $appointment->appointment_date->toDateString(),
                'time_slot' => $appointment->time_slot,
                'checkin_opens_at' => $expiryService->getCheckinOpening($appointment)->toIso8601String(),
                'checkin_deadline_at' => $expiryService->getCheckinDeadline($appointment)->toIso8601String(),
            ],
            'has_active_checkin' => (bool) $checkin,
            'active_checkin' => $checkin ? $this->ticket($checkin) : null,
        ]]);
    }
    public function checkin(Request $request)
    {
        $request->validate([
            'chief_complaint' => 'required|string|max:500',
            'severity' => 'required|in:mild,moderate,severe,critical',
            'red_flags' => 'nullable|array',
            'red_flags.*' => 'string|in:difficulty_breathing,severe_chest_pain,heavy_uncontrolled_bleeding,fainting,severe_allergic_reaction,seizure,sudden_weakness_confusion,none',
            'notes' => 'nullable|string|max:1000',
        ]);
        $student = KioskIdentity::student($request);
        $created = false;
        $checkin = DB::transaction(function () use ($request, $student, &$created) {
            ClinicQueue::lock();
            $appointment = KioskIdentity::appointment($student, true);
            $existing = AppointmentCheckin::where('appointment_id', $appointment->id)->where('is_walk_in', false)->first();
            if ($existing) return $existing; // Sa retry, gamitin ang existing row at queue number.
            $flags = $request->input('red_flags') ?: [];
            $priority = $this->triagePriority($student, $request->severity, $flags, $request->chief_complaint);
            $type = $priority === 'HIGH' ? 'priority' : 'regular';
            $number = ClinicQueue::allocate($type);
            $checkin = AppointmentCheckin::create([
                'appointment_id' => $appointment->id, 'user_id' => $student->id,
                'queue_number' => $number, 'queue_type' => $type, 'is_walk_in' => false,
                'triage_reason' => mb_substr($request->chief_complaint, 0, 191),
                'chief_complaint' => $request->chief_complaint, 'checkin_status' => 'confirmed',
                'checked_in_at' => now(), 'check_in_time' => now(), 'status' => 'waiting',
            ]);
            $checkin->triage()->create(['chief_complaint' => $request->chief_complaint, 'severity' => $request->severity, 'red_flags' => $flags, 'priority' => $priority, 'notes' => $request->notes]);
            $appointment->forceFill(['checked_in_at' => now(), 'queue_number' => $number, 'queue_type' => $type])->save();
            $created = true;
            return $checkin;
        }, 3);
        return response()->json(['success' => true, 'message' => $created ? 'Check-in successful.' : 'Already checked in.', 'data' => $this->ticket($checkin)], $created ? 201 : 200);
    }
    private function ticket($checkin): array
    {
        return [
            'id' => $checkin->id, 'queue_number' => $checkin->queue_number, 'queue_type' => $checkin->queue_type,
            'status' => $checkin->status, 'check_in_time' => $checkin->check_in_time,
            'priority' => optional($checkin->triage)->priority ?: 'LOW',
        ];
    }
    public function todayQueue(Request $request)
    {
        // Hiwalay ang auth at role checks ng Nurse routes.
        $nurse = $request->is('api/nurse/*');
        if (!$nurse) {
            app(\App\Services\SkippedQueueExpiry::class)->run();
            // Kiosk tickets need no patient models, full triage notes, or model serialization.
            $queue = DB::table('appointment_checkins as c')
                ->leftJoin('triage_assessments as t', 't.appointment_checkin_id', '=', 'c.id')
                ->where('c.created_at', '>=', today())->where('c.created_at', '<', today()->addDay())
                ->where('c.is_walk_in', false)->whereIn('c.status', ['waiting', 'serving', 'called', 'skipped', 'no_show'])
                ->select(['c.id', 'c.queue_number', 'c.queue_type', 'c.status', 'c.check_in_time', 'c.called_at'])
                ->selectRaw("COALESCE(t.priority, 'LOW') AS priority")
                ->orderByRaw("CASE t.priority WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END")
                ->orderByRaw('CASE WHEN c.check_in_time IS NULL THEN 0 ELSE 1 END')
                ->orderBy('c.check_in_time')->orderBy('c.created_at')->orderBy('c.id')
                ->get()->map(function ($row) {
                    $row->check_in_time = $row->check_in_time ? \Carbon\Carbon::parse($row->check_in_time)->toJSON() : null;
                    $row->called_at = $row->called_at ? \Carbon\Carbon::parse($row->called_at)->toJSON() : null;
                    return $row;
                });
            return response()->json(['success' => true, 'data' => [
                'now_serving' => $queue->firstWhere('status', 'serving'),
                'now_called' => $queue->firstWhere('status', 'called'),
                'queue' => $queue,
                'total_waiting' => $queue->whereIn('status', ['waiting', 'called'])->count(),
            ]]);
        }
        $query = ClinicQueue::ordered();
        // Kiosk tickets only need triage priority; skip two unused relation queries.
        if (!$nurse) $query->without(['user', 'appointment']);
        $queue = $query->get();
        $serving = $queue->firstWhere('status', 'serving');
        $called = $queue->firstWhere('status', 'called');
        return response()->json(['success' => true, 'data' => [
            'now_serving' => $serving ? ($nurse ? $serving : $this->ticket($serving)) : null,
            'now_called' => $called ? ($nurse ? $called : $this->ticket($called)) : null,
            'queue' => $nurse ? $queue : $queue->map(function ($row) { return $this->ticket($row); }),
            'total_waiting' => $queue->whereIn('status', ['waiting', 'called'])->count(),
        ]]);
    }
    public function callNext()
    {
        $next = DB::transaction(function () {
            ClinicQueue::lock();
            // Kasama ang older unfinished visits hanggang ma-save ang consultation.
            abort_if(AppointmentCheckin::where('is_walk_in', false)->whereIn('status', ['serving', 'called'])->exists(), 409, 'Confirm arrival or skip the called patient, and complete the serving visit before calling another.');
            $next = ClinicQueue::ordered()->where('status', 'waiting')->first();
            if ($next) {
                $next->update([
                    'status' => 'called',
                    'called_at' => now(),
                    'called_by' => auth()->id(),
                ]);
                $next->refresh(); // Refresh to get the called_at value
            }
            return $next;
        }, 3);
        return response()->json(['success' => true, 'data' => $next, 'message' => $next ? 'Patient called.' : 'No patients waiting.']);
    }
    public function patientArrived(Request $request, $id)
    {
        $checkin = DB::transaction(function () use ($id) {
            ClinicQueue::lock();
            $checkin = AppointmentCheckin::findOrFail($id);
            abort_unless($checkin->status === 'called', 409, 'This patient is not in called status.');
            $checkin->update([
                'status' => 'serving',
            ]);
            return $checkin;
        }, 3);
        return response()->json(['success' => true, 'data' => $checkin, 'message' => 'Patient marked as arrived.']);
    }
    public function recallPatient(Request $request, $id)
    {
        $checkin = DB::transaction(function () use ($id) {
            ClinicQueue::lock();
            $checkin = AppointmentCheckin::findOrFail($id);
            abort_unless($checkin->status === 'called', 409, 'This patient is not in called status.');
            $checkin->update([
                'called_at' => now(),
                'called_by' => auth()->id(),
            ]);
            return $checkin;
        }, 3);
        return response()->json(['success' => true, 'data' => $checkin, 'message' => 'Patient recalled.']);
    }
    public function markNoShow(Request $request, $id)
    {
        // Reject obsolete timer-driven clients instead of bypassing nurse Skip.
        abort(409, 'Automatic no-show is no longer supported. Refresh the queue and use Skip or Mark Returned.');
    }
    public function skipPatient(Request $request, $id)
    {
        $checkin = DB::transaction(function () use ($id, $request) {
            ClinicQueue::lock();
            $checkin = AppointmentCheckin::lockForUpdate()->findOrFail($id);
            abort_unless($checkin->status === 'called' && !$checkin->is_walk_in, 409, 'Only called patients can be skipped.');
            abort_if($checkin->consultation()->exists(), 409, 'This visit already has a consultation.');
            NurseVisitClaim::acquire($request, $id);
            $checkin->update(['status' => 'skipped', 'skipped_at' => now(), 'skipped_by' => auth()->id()]);
            DB::table('nurse_visit_claims')->where('checkin_id', $id)->delete();
            // An overdue CALLED entry is protected until this explicit nurse action.
            app(\App\Services\SkippedQueueExpiry::class)->run();
            return $checkin->fresh();
        }, 3);
        return response()->json(['success' => true, 'data' => $checkin, 'message' =>
            $checkin->status === 'no_show' ? 'Skipped patient marked no-show because the original deadline has passed.' : 'Patient skipped. Mark returned when they arrive.']);
    }
    public function markReturned(Request $request, $id)
    {
        $checkin = DB::transaction(function () use ($id) {
            ClinicQueue::lock();
            $checkin = AppointmentCheckin::lockForUpdate()->findOrFail($id);
            abort_unless($checkin->status === 'skipped' && !$checkin->is_walk_in, 409, 'Only skipped patients can be marked returned.');
            $appointment = Appointment::findOrFail($checkin->appointment_id);
            abort_unless(now('Asia/Manila')->lt(app(AppointmentExpiry::class)->getCheckinDeadline($appointment)),
                409, 'The original check-in deadline has passed. This skipped visit is no longer eligible.');
            $checkin->update(['status' => 'waiting', 'returned_at' => now(), 'returned_by' => auth()->id()]);
            return $checkin;
        }, 3);
        return response()->json(['success' => true, 'data' => $checkin, 'message' => 'Patient marked returned and eligible for Call Next.']);
    }
    public function claimVisit(Request $request, $id)
    {
        return DB::transaction(function () use ($request, $id) {
            ClinicQueue::lock();
            $checkin = AppointmentCheckin::findOrFail($id);
            abort_unless(in_array($checkin->status, ['called', 'serving']), 409, 'This visit is no longer available for consultation. Your inputs are preserved.');
            NurseVisitClaim::acquire($request, $id);
            return response()->json(['success' => true]);
        }, 3);
    }
    public function releaseVisit(Request $request, $id)
    {
        DB::table('nurse_visit_claims')->where('checkin_id', $id)
            ->where('session_hash', NurseVisitClaim::session($request))->delete();
        return response()->json(['success' => true]);
    }
    private function triagePriority($user, $severity, array $redFlags, $complaint)
    {
        if (count(array_diff($redFlags, ['none'])) > 0 || in_array($severity, ['severe', 'critical'], true)) {
            return 'HIGH';
        }

        if ($severity === 'moderate') return 'MEDIUM';

        $profile = $user->healthProfile;
        if (!$profile) return 'LOW';

        $complaint = strtolower((string) $complaint);
        $history = is_array($profile->medical_history)
            ? $profile->medical_history
            : (json_decode($profile->medical_history, true) ?: []);
        $context = strtolower(implode(' ', array_merge(
            array_map('strval', $history),
            [$profile->other_medical_history, $profile->medications]
        )));

        $relatedPairs = [
            ['asthma', ['breathing', 'wheezing', 'shortness of breath']],
            ['diabetes', ['thirst', 'glucose', 'sugar', 'dizzy', 'wound']],
            ['hypertension', ['blood pressure', 'headache', 'dizzy', 'chest']],
            ['heart', ['chest', 'palpitation', 'breathing']],
            ['kidney', ['urine', 'swelling', 'flank']],
        ];
        foreach ($relatedPairs as [$condition, $symptoms]) {
            if (stripos($context, $condition) !== false) {
                foreach ($symptoms as $symptom) {
                    if (stripos($complaint, $symptom) !== false) return 'MEDIUM';
                }
            }
        }

        return 'LOW';
    }
}
