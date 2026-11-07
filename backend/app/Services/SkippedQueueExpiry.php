<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\AppointmentCheckin;
use App\Support\ClinicSettings;
use App\Support\TimeGuard;
use Illuminate\Support\Facades\DB;

class SkippedQueueExpiry
{
    /** The default arrival time only; the clinic's own is ClinicSettings::callTimeoutSeconds(). */
    public const CALL_TIMEOUT_SECONDS = ClinicSettings::DEFAULT_CALL_TIMEOUT_SECONDS;

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
     * A called student who has not been confirmed as arrived within the clinic's arrival time
     * (Consultation → Queue list → Options; 1 minute by default) did not arrive: the visit is
     * closed as No Show right away (no Recall / On hold) and the student is told to book a new
     * appointment. The nurse's popup shows the same notice.
     */
    public function skipOverdueCalls(): int
    {
        $cutoff = now()->subSeconds(ClinicSettings::callTimeoutSeconds());
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
                        $checkin->update(['status' => 'no_show', 'no_show_at' => now(), 'no_show_by' => null]);
                        Appointment::whereKey($checkin->appointment_id)->first()?->forceFill(['no_show' => true])->save();
                        DB::table('nurse_visit_claims')->where('checkin_id', $checkin->id)->delete();
                        \App\Models\Notification::create([
                            'user_id' => $checkin->user_id, 'type' => 'appointment_no_show', 'title' => 'Missed Clinic Call',
                            'message' => 'You were called at the clinic but did not arrive in time. Please book a new appointment.',
                        ]);
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
