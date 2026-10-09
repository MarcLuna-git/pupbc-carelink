<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\AppointmentCheckin;
use Illuminate\Support\Facades\DB;

class SkippedQueueExpiry
{
    /** Reconcile only students still skipped, using their original slot deadline. */
    public function run(): int
    {
        $count = 0;
        AppointmentCheckin::where('status', 'skipped')->where('is_walk_in', false)
            ->with('appointment')->orderBy('id')->chunkById(100, function ($checkins) use (&$count) {
                foreach ($checkins as $candidate) {
                    $appointment = $candidate->appointment;
                    if (!$appointment || $appointment->status === 'completed' ||
                        now('Asia/Manila')->lt(app(AppointmentExpiry::class)->getCheckinDeadline($appointment))) {
                        continue;
                    }
                    DB::transaction(function () use ($candidate, &$count) {
                        ClinicQueue::lock();
                        $appointment = Appointment::whereKey($candidate->appointment_id)->lockForUpdate()->first();
                        $checkin = AppointmentCheckin::whereKey($candidate->id)->lockForUpdate()->first();
                        if (!$appointment || !$checkin || $checkin->status !== 'skipped' ||
                            $appointment->status === 'completed' ||
                            $checkin->consultation()->exists() ||
                            now('Asia/Manila')->lt(app(AppointmentExpiry::class)->getCheckinDeadline($appointment))) {
                            return;
                        }
                        $checkin->update(['status' => 'no_show', 'no_show_at' => now(), 'no_show_by' => null]);
                        $appointment->forceFill(['no_show' => true])->save();
                        DB::table('nurse_visit_claims')->where('checkin_id', $checkin->id)->delete();
                        $count++;
                    }, 3);
                }
            });
        return $count;
    }
}
