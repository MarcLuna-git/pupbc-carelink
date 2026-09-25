<?php
namespace App\Http\Controllers\Api\Kiosk;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\AppointmentCheckin;
use App\Models\AppointmentSlot;
use App\Services\ClinicQueue;
use App\Services\KioskIdentity;
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
        return response()->json(['success' => true, 'data' => [
            'user' => $student->only(['student_id', 'first_name', 'last_name']),
            'appointment' => ['service' => $appointment->service, 'appointment_date' => $appointment->appointment_date->toDateString(), 'time_slot' => $appointment->time_slot],
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
            $appointment = KioskIdentity::appointment($student);
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
        $queue = ClinicQueue::ordered()->get();
        $serving = $queue->firstWhere('status', 'serving');
        // Hiwalay ang auth at role checks ng Nurse routes.
        $nurse = $request->is('api/nurse/*');
        return response()->json(['success' => true, 'data' => [
            'now_serving' => $serving ? ($nurse ? $serving : $this->ticket($serving)) : null,
            'queue' => $nurse ? $queue : $queue->map(function ($row) { return $this->ticket($row); }),
            'total_waiting' => $queue->where('status', 'waiting')->count(),
        ]]);
    }
    public function callNext()
    {
        $next = DB::transaction(function () {
            ClinicQueue::lock();
            // Kasama ang older unfinished visits hanggang ma-save ang consultation.
            abort_if(AppointmentCheckin::where('is_walk_in', false)->where('status', 'serving')->exists(), 409, 'Complete the current consultation before calling another patient.');
            $next = ClinicQueue::ordered()->where('status', 'waiting')->first();
            if ($next) $next->update(['status' => 'serving']);
            return $next;
        }, 3);
        return response()->json(['success' => true, 'data' => $next, 'message' => $next ? 'Patient called.' : 'No patients waiting.']);
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
