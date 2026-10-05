<?php

namespace App\Services;

use App\Models\Consultation;
use App\Models\EmergencyEncounter;

class ClinicHistory
{
    public function forStudent(?string $id, bool $studentView = false)
    {
        $visits = Consultation::with(['nurse:id,first_name,last_name', 'user:id,student_id,first_name,last_name,course,year,section', 'user.profile:id,user_id,course,year,section', 'appointment', 'checkin.triage'])
            ->when($id, function ($q) use ($id) { $q->where('user_id', $id); })->where('status', 'completed')->get()->map(function ($item) use ($studentView) {
                $record = [
                    'id' => $item->id, 'record_type' => 'consultation', 'occurred_at' => $item->created_at,
                    'status' => 'completed', 'chief_complaint' => $item->chief_complaint,
                    'vital_signs' => $item->vital_signs, 'general_remarks' => $item->general_remarks,
                    'medical_certificate' => $item->medical_certificate, 'medical_certificate_ref' => $item->medical_certificate_ref,
                    'follow_up_required' => $item->follow_up_required, 'follow_up_date' => $item->follow_up_date,
                    'nurse' => $item->nurse ? $item->nurse->only(['first_name', 'last_name']) : null,
                    'appointment' => $item->appointment ? $item->appointment->only(['id', 'service', 'appointment_date', 'time_slot', 'status']) : null,
                    'checkin' => $item->checkin ? $item->checkin->only(['id', 'queue_number', 'status', 'check_in_time']) : null,
                    'triage' => $item->checkin && $item->checkin->triage ? $item->checkin->triage->only($studentView ? ['chief_complaint', 'severity', 'priority'] : ['chief_complaint', 'severity', 'priority', 'red_flags', 'notes']) : null,
                ];
                if (!$studentView) $record['student'] = $item->user ? $this->studentData($item->user) : null;
                return $record;
            });
        $emergencies = EmergencyEncounter::with(['nurse:id,first_name,last_name', 'student:id,student_id,first_name,last_name,course,year,section', 'student.profile:id,user_id,course,year,section'])->when($id, function ($q) use ($id) { $q->where('user_id', $id); })->get()->map(function ($item) use ($studentView) {
            $record = $item->only(['id', 'incident_datetime', 'reason', 'symptoms', 'assessment', 'intervention', 'disposition']);
            $record['record_type'] = 'emergency';
            $record['occurred_at'] = $item->incident_datetime;
            $record['status'] = 'completed';
            $record['nurse'] = $item->nurse ? $item->nurse->only(['first_name', 'last_name']) : null;
            if (!$studentView) { $record['notes'] = $item->notes; $record['student'] = $item->student ? $this->studentData($item->student) : null; }
            return $record;
        });
        return $visits->concat($emergencies)->sortByDesc(function ($row) { return $row['occurred_at']->getTimestamp(); })->values();
    }
    private function studentData(\App\Models\User $student): array
    {
        return array_merge($student->only(['student_id', 'first_name', 'last_name']), [
            'course' => $student->profile->course ?? $student->course,
            'year' => $student->profile->year ?? $student->year,
            'section' => $student->profile->section ?? $student->section,
        ]);
    }
}
