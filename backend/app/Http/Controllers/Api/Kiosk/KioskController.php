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
use App\Support\TimeGuard;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
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
                // The reason typed in the portal: shown on the confirm screen and starts the symptoms field.
                'concern' => $appointment->concern,
                'appointment_date' => $appointment->appointment_date->toDateString(),
                'time_slot' => $appointment->time_slot,
                'checkin_opens_at' => $expiryService->getCheckinOpening($appointment)->toIso8601String(),
                'checkin_deadline_at' => $expiryService->getCheckinDeadline($appointment)->toIso8601String(),
            ],
            'has_active_checkin' => (bool) $checkin,
            'active_checkin' => $checkin ? $this->ticket($checkin) : null,
        ]]);
    }
    // Answers for "How long have you had these symptoms?" on the kiosk.
    public const SYMPTOM_DURATIONS = ['Today', '1-2 days', '3-7 days', 'More than a week'];

    // Only General Consultation goes through the kiosk triage form.
    public static function needsTriage(?string $service): bool
    {
        return $service === 'Consultation';
    }

    // Pain 1-3 mild, 4-6 moderate, 7-10 severe (same bands the kiosk shows).
    private static function painSeverity(int $pain): string
    {
        return $pain <= 3 ? 'mild' : ($pain <= 6 ? 'moderate' : 'severe');
    }

    public function checkin(Request $request)
    {
        // Only General Consultation is triaged; the other services are checked in from what the
        // student already wrote in the portal, so these fields are checked once the service is known.
        $request->validate([
            'chief_complaint' => 'nullable|string|max:500',
            'symptom_duration' => ['nullable', Rule::in(self::SYMPTOM_DURATIONS)],
            'severity' => 'nullable|in:mild,moderate,severe,critical',
            'pain_level' => 'nullable|integer|between:1,10',
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
            if (self::needsTriage($appointment->service)) {
                $request->validate([
                    'chief_complaint' => 'required|string|max:500',
                    'symptom_duration' => ['required', Rule::in(self::SYMPTOM_DURATIONS)],
                    'pain_level' => 'required|integer|between:1,10',
                    'red_flags' => 'required|array|min:1',
                ], [
                    'chief_complaint.required' => 'Please describe your symptoms.',
                    'symptom_duration.required' => 'Please tell us how long you have had these symptoms.',
                    'pain_level.required' => 'Please rate your pain from 1 to 10.',
                    'red_flags.required' => 'Please answer the warning signs question.',
                ]);
                $triage = [
                    'chief_complaint' => $request->chief_complaint, 'symptom_duration' => $request->symptom_duration,
                    'severity' => self::painSeverity((int) $request->pain_level), 'pain_level' => (int) $request->pain_level,
                    'red_flags' => $request->input('red_flags'), 'notes' => $request->notes,
                ];
                $priority = $this->triagePriority($student, $triage['severity'], $triage['red_flags'], $triage['chief_complaint']);
            } else {
                // Med cert, follow-up, vaccination and other: no triage, regular queue, the
                // portal reason becomes the chief complaint.
                $triage = [
                    'chief_complaint' => trim((string) $appointment->concern) ?: $appointment->service, 'symptom_duration' => null,
                    'severity' => 'mild', 'pain_level' => null, 'red_flags' => ['none'], 'notes' => null,
                ];
                $priority = 'LOW';
            }
            $type = $priority === 'HIGH' ? 'priority' : 'regular';
            $number = ClinicQueue::allocate($type);
            $checkin = AppointmentCheckin::create([
                'appointment_id' => $appointment->id, 'user_id' => $student->id,
                'queue_number' => $number, 'queue_type' => $type, 'is_walk_in' => false,
                'triage_reason' => mb_substr($triage['chief_complaint'], 0, 191),
                'chief_complaint' => $triage['chief_complaint'], 'checkin_status' => 'confirmed',
                'checked_in_at' => now(), 'check_in_time' => now(), 'status' => 'waiting',
            ]);
            $checkin->triage()->create($triage + ['priority' => $priority]);
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
                // The Developer tools demo patient stays on the nurse queue list only.
                ->when(\App\Support\DemoQueue::userIds(), fn ($q, $demoIds) => $q->whereNotIn('c.user_id', $demoIds))
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
        // Developer tools demo patient: back in line once their last visit ended.
        if ($nurse) \App\Support\DemoQueue::ensure();
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
            abort_if(ClinicQueue::busy()->exists(), 409, 'Finish the called or serving patient before calling another.');
            $next = ClinicQueue::ordered()->where('status', 'waiting')->first();
            if ($next) {
                $next->update([
                    'status' => 'called',
                    'called_at' => now(),
                    'called_by' => auth()->id(),
                ]);
                $next->refresh(); // Refresh to get the called_at value
                // Tell the student by email and in the portal. Demo patients have no real inbox.
                $appointment = $next->appointment_id ? Appointment::find($next->appointment_id) : null;
                if ($appointment && !in_array($next->user_id, \App\Support\DemoQueue::userIds(), true)) {
                    app(\App\Services\AppointmentEventNotification::class)->send($appointment, 'called');
                }
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
    public function servePatient(Request $request, $id)
    {
        $checkin = DB::transaction(function () use ($id) {
            ClinicQueue::lock();
            $checkin = AppointmentCheckin::findOrFail($id);
            abort_unless($checkin->status === 'waiting', 409, 'This patient is not in waiting status.');
            abort_if(ClinicQueue::busy()->exists(), 409, 'Finish the called or serving patient before calling another.');
            $checkin->update([
                'status' => 'serving',
                'served_at' => now(),
                'served_by' => auth()->id(),
            ]);
            return $checkin;
        }, 3);
        return response()->json(['success' => true, 'data' => $checkin, 'message' => 'Patient now in consultation.']);
    }
    /*
     * Recall has two uses. A called patient is announced again and the arrival
     * timer restarts. A skipped patient (did not arrive in time) who came back is called again,
     * as long as nobody else is called or being served and their appointment deadline has not passed.
     * A patient on hold is recalled the same way, but the deadline does not apply: the nurse put
     * them on hold to wait for them.
     */
    public function recallPatient(Request $request, $id)
    {
        $checkin = DB::transaction(function () use ($id) {
            ClinicQueue::lock();
            $checkin = AppointmentCheckin::lockForUpdate()->findOrFail($id);
            abort_if($checkin->is_walk_in, 409, 'Walk-in visits cannot be recalled.');

            if (in_array($checkin->status, ['skipped', 'on_hold'], true)) {
                abort_if(
                    ClinicQueue::busy()->where('id', '!=', $checkin->id)->exists(),
                    409,
                    'Finish the patient who is called or being served before recalling a skipped patient.'
                );
                abort_if($checkin->consultation()->exists(), 409, 'This visit already has a consultation.');
                $appointment = Appointment::findOrFail($checkin->appointment_id);
                abort_unless($checkin->status === 'on_hold' || TimeGuard::nursePortalBypassed() || now('Asia/Manila')->lt(app(AppointmentExpiry::class)->getCheckinDeadline($appointment)),
                    409, 'The original check-in deadline has passed. This skipped visit is no longer eligible.');
                $checkin->update([
                    'status' => 'called', 'called_at' => now(), 'called_by' => auth()->id(),
                    'returned_at' => now(), 'returned_by' => auth()->id(),
                ]);
                return $checkin;
            }

            abort_unless($checkin->status === 'called', 409, 'This patient is not in called status.');
            $checkin->update([
                'called_at' => now(),
                'called_by' => auth()->id(),
            ]);
            return $checkin;
        }, 3);
        return response()->json(['success' => true, 'data' => $checkin, 'message' => 'Patient recalled.']);
    }
    /*
     * The nurse sets a skipped patient aside: not arrived yet, but maybe still coming. A visit on
     * hold is not a No Show and is not closed at the check-in deadline (SkippedQueueExpiry only
     * closes skipped visits); Recall brings the patient back, Close as No show ends the visit.
     * Visits still on hold after their day are closed as No Show (AppointmentExpiry).
     */
    public function holdPatient(Request $request, $id)
    {
        $checkin = DB::transaction(function () use ($id) {
            ClinicQueue::lock();
            $checkin = AppointmentCheckin::lockForUpdate()->findOrFail($id);
            abort_unless($checkin->status === 'skipped', 409, 'Only a skipped patient can be put on hold.');
            abort_if($checkin->consultation()->exists(), 409, 'This visit already has a consultation.');
            $checkin->update(['status' => 'on_hold']);
            DB::table('nurse_visit_claims')->where('checkin_id', $checkin->id)->delete();
            return $checkin;
        }, 3);
        return response()->json(['success' => true, 'data' => $checkin, 'message' => 'Patient on hold.']);
    }
    /*
     * The nurse confirms a skipped or on-hold patient is not coming back, without waiting for the
     * check-in deadline that would mark them no-show anyway (SkippedQueueExpiry).
     * Only skipped or on-hold visits: a called patient is still skipped by the timer first.
     */
    public function markNoShow(Request $request, $id)
    {
        $checkin = DB::transaction(function () use ($id) {
            ClinicQueue::lock();
            $checkin = AppointmentCheckin::lockForUpdate()->findOrFail($id);
            abort_unless(in_array($checkin->status, ['skipped', 'on_hold'], true), 409, 'Only a skipped or on-hold patient can be marked as no show.');
            abort_if($checkin->consultation()->exists(), 409, 'This visit already has a consultation.');
            $checkin->update(['status' => 'no_show', 'no_show_at' => now(), 'no_show_by' => auth()->id()]);
            Appointment::whereKey($checkin->appointment_id)->first()?->forceFill(['no_show' => true])->save();
            DB::table('nurse_visit_claims')->where('checkin_id', $checkin->id)->delete();
            return $checkin;
        }, 3);
        return response()->json(['success' => true, 'data' => $checkin, 'message' => 'Marked as no show.']);
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
