<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\AppointmentCheckin;
use Illuminate\Support\Facades\DB;
use App\Support\TimeGuard;
use Carbon\Carbon;

class AppointmentExpiry
{
    /** Expire overdue pending/approved appointments without deleting history. */
    public function run(): int
    {
        // Nurse → Developer Tools → Remove time Guard: no automatic expiry at all.
        // The student's own switch never stops it; each portal keeps its own rules.
        if (TimeGuard::nursePortalBypassed()) {
            return 0;
        }

        $count = 0;

        // 1. Expire pending appointments whose slot can no longer be attended
        $count += $this->expirePendingAppointments();

        // 2. Expire approved appointments that missed their check-in window
        $count += $this->expireApprovedAppointments();

        return $count;
    }

    protected function expirePendingAppointments(): int
    {
        $count = 0;

        // Past dates, and today's requests whose slot check-in deadline has passed
        // (reachable when a student books a past slot with their time guard off).
        Appointment::where('status', 'pending')
            ->whereDate('appointment_date', '<=', today('Asia/Manila')->toDateString())
            ->orderBy('id')
            ->chunkById(100, function ($appointments) use (&$count) {
                foreach ($appointments as $appointment) {
                    if (now('Asia/Manila')->lt($this->getSlotDeadline($appointment))) {
                        continue;
                    }
                    DB::transaction(function () use ($appointment, &$count) {
                        ClinicQueue::lock();
                        $locked = Appointment::whereKey($appointment->id)->lockForUpdate()->first();
                        if (!$locked || $locked->status !== 'pending' || now('Asia/Manila')->lt($this->getSlotDeadline($locked))) {
                            return;
                        }

                        $locked->update(['status' => 'expired']);
                        app(AppointmentEventNotification::class)->send($locked);
                        $count++;
                    });
                }
            });

        return $count;
    }

    protected function expireApprovedAppointments(): int
    {
        $count = 0;

        // Include earlier dates to catch up after sleep/outages. A successful
        // check-in remains successful even after its queue status changes.
        Appointment::where('status', 'approved')
            ->whereDate('appointment_date', '<=', today('Asia/Manila')->toDateString())
            ->whereDoesntHave('checkins', function ($query) {
                $query->where('is_walk_in', false);
            })
            ->orderBy('id')
            ->chunkById(100, function ($appointments) use (&$count) {
                foreach ($appointments as $appointment) {
                    if (now('Asia/Manila')->lt($this->getCheckinDeadline($appointment))) {
                        continue;
                    }
                    DB::transaction(function () use ($appointment, &$count) {
                        // Same mutex/order as kiosk check-in: never race admission.
                        ClinicQueue::lock();
                        $locked = Appointment::whereKey($appointment->id)->lockForUpdate()->first();
                        if (!$locked || $locked->status !== 'approved') {
                            return;
                        }

                        if (now('Asia/Manila')->lt($this->getCheckinDeadline($locked))) {
                            return;
                        }

                        // Recheck after acquiring the mutex: admission may have
                        // completed since the candidate query was executed.
                        if (AppointmentCheckin::where('appointment_id', $locked->id)
                            ->where('is_walk_in', false)->exists()) {
                            return;
                        }

                        $locked->update(['status' => 'expired']);
                        app(AppointmentEventNotification::class)->send($locked);
                        $count++;
                    });
                }
            });

        return $count;
    }

    /**
     * Get the check-in deadline for an appointment.
     * Returns a Carbon instance in Asia/Manila timezone.
     */
    public function getCheckinDeadline(Appointment $appointment): Carbon
    {
        // Kiosk → Developer Tools → Remove time Guard: open until the day ends.
        if (TimeGuard::kioskBypassed()) {
            return $this->slotTime($appointment)->endOfDay();
        }
        return $this->getSlotDeadline($appointment);
    }

    /**
     * The normal check-in deadline (slot + late minutes), ignoring every
     * Developer Tools switch. Pending requests expire once it passes.
     */
    public function getSlotDeadline(Appointment $appointment): Carbon
    {
        return $this->slotTime($appointment)->addMinutes(config('checkin.checkin_late_minutes', 30));
    }

    private function slotTime(Appointment $appointment): Carbon
    {
        return Carbon::createFromFormat(
            '!Y-m-d g:i A',
            $appointment->appointment_date->format('Y-m-d') . ' ' . $appointment->time_slot,
            'Asia/Manila'
        );
    }

    /**
     * Get the check-in opening time for an appointment.
     * Returns a Carbon instance in Asia/Manila timezone.
     */
    public function getCheckinOpening(Appointment $appointment): Carbon
    {
        $slot = $this->slotTime($appointment);
        // Kiosk → Developer Tools → Remove time Guard: open from the start of the day.
        if (TimeGuard::kioskBypassed()) {
            return $slot->startOfDay();
        }
        return $slot->subMinutes(config('checkin.checkin_early_minutes', 15));
    }

    /**
     * Check if an appointment is within its check-in window.
     */
    public function isWithinCheckinWindow(Appointment $appointment): bool
    {
        $now = now('Asia/Manila');
        return $now->gte($this->getCheckinOpening($appointment)) && $now->lt($this->getCheckinDeadline($appointment));
    }

    /**
     * Check if an appointment's check-in window has opened.
     */
    public function hasCheckinWindowOpened(Appointment $appointment): bool
    {
        return now('Asia/Manila')->gte($this->getCheckinOpening($appointment));
    }

    /**
     * Check if an appointment's check-in deadline has passed.
     */
    public function isCheckinDeadlinePassed(Appointment $appointment): bool
    {
        return now('Asia/Manila')->gte($this->getCheckinDeadline($appointment));
    }
}
