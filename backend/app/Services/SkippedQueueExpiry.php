<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\AppointmentCheckin;
use App\Support\TimeGuard;
use Illuminate\Support\Facades\DB;

class SkippedQueueExpiry
{
    /** A called student has this long to show up before being skipped automatically. */
    public const CALL_TIMEOUT_SECONDS = 60;

    /**
     * Server-side housekeeping that runs before every nurse queue/sync request and
     * on kiosk queue reads: 1) skip called students who did not arrive in time,
     * 2) turn students who are still skipped at their appointment deadline into no-shows.
     * Returns the number of no-shows (the second step).
     */
    public function run(): int
    {
        // Nurse → Developer Tools → Remove time Guard: keep called and skipped patients as they are.
        if (TimeGuard::nursePortalBypassed()) {
            return 0;
        }

        $this->skipOverdueCalls();

        return $this->markNoShows();
    }

    /*
     * A called student who has not been confirmed as arrived within CALL_TIMEOUT_SECONDS is
     * skipped. The row stays in the queue as "skipped" until their appointment deadline, and the
     * nurse can Recall them if they come back. Identity, queue number and priority are unchanged.
     */
    public function skipOverdueCalls(): int
    {
        $cutoff = now()->subSeconds(self::CALL_TIMEOUT_SECONDS);
        $count = 0;

        AppointmentCheckin::where('status', 'called')->where('is_walk_in', false)
            ->where('called_at', '<=', $cutoff)->orderBy('id')->chunkById(100, function ($checkins) use ($cutoff, &$count) {
                foreach ($checkins as $candidate) {
                    DB::transaction(function () use ($candidate, $cutoff, &$count) {
                        ClinicQueue::lock();
                        $checkin = AppointmentCheckin::whereKey($candidate->id)->lockForUpdate()->first();
                        // Re-check under the lock: the nurse may just have confirmed arrival or recalled.
                        if (!$checkin || $checkin->status !== 'called' || !$checkin->called_at
                            || $checkin->called_at->gt($cutoff) || $checkin->consultation()->exists()) {
                            return;
                        }
                        $checkin->update(['status' => 'skipped', 'skipped_at' => now(), 'skipped_by' => null]);
                        DB::table('nurse_visit_claims')->where('checkin_id', $checkin->id)->delete();
                        $count++;
                    }, 3);
                }
            });

        return $count;
    }

    /** Reconcile only students still skipped, using their original slot deadline. */
    private function markNoShows(): int
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
