<?php

namespace App\Services;

use App\Models\AppointmentCheckin;
use Illuminate\Support\Facades\DB;

class ClinicQueue
{
    // Tawagin sa transaction bago i-lock ang appointments/check-ins.
    public static function lock(): void
    {
        if (!DB::table('clinic_queue_locks')->where('id', 1)->lockForUpdate()->first()) {
            throw new \RuntimeException('Clinic queue migration is required.');
        }
    }

    public static function ordered()
    {
        return AppointmentCheckin::with(['user:id,student_id,first_name,last_name', 'triage', 'appointment'])
            ->whereDate('appointment_checkins.created_at', today())
            ->where('is_walk_in', false)
            ->whereIn('status', ['waiting', 'serving'])
            ->orderByRaw("COALESCE((SELECT CASE priority WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END FROM triage_assessments WHERE appointment_checkin_id = appointment_checkins.id LIMIT 1), 2)")
            ->orderByRaw('CASE WHEN check_in_time IS NULL THEN 0 ELSE 1 END')
            ->orderBy('check_in_time')->orderBy('appointment_checkins.created_at')->orderBy('appointment_checkins.id');
    }

    public static function allocate(string $type): string
    {
        $day = today()->toDateString();
        $query = DB::table('clinic_queue_counters')->where('queue_date', $day)->where('queue_type', $type);
        $counter = $query->first();
        $last = $counter ? $counter->last_number : 0;
        // Isama ang historical allocations; huwag palitan ang existing queue numbers.
        foreach (AppointmentCheckin::whereDate('created_at', $day)->where('queue_type', $type)->pluck('queue_number') as $number) {
            if (preg_match('/^[PR]-(\d+)$/', (string) $number, $match)) $last = max($last, (int) $match[1]);
        }
        $next = $last + 1;
        DB::table('clinic_queue_counters')->updateOrInsert(['queue_date' => $day, 'queue_type' => $type], ['last_number' => $next]);
        return ($type === 'priority' ? 'P-' : 'R-') . str_pad($next, 3, '0', STR_PAD_LEFT);
    }
}
