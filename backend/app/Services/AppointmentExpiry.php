<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\AppointmentCheckin;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AppointmentExpiry
{
    /** Expire overdue pending/approved appointments without deleting history. */
    public function run(): int
    {
        $count = 0;

        // 1. Expire pending appointments whose date has passed (original behavior)
        $count += $this->expirePendingAppointments();

        // 2. Expire approved appointments that missed their check-in window
        $count += $this->expireApprovedAppointments();

        return $count;
    }

    protected function expirePendingAppointments(): int
    {
        $count = 0;

        Appointment::where('status', 'pending')
            ->whereDate('appointment_date', '<', today('Asia/Manila')->toDateString())
            ->orderBy('id')
            ->chunkById(100, function ($appointments) use (&$count) {
                foreach ($appointments as $appointment) {
                    DB::transaction(function () use ($appointment, &$count) {
                        ClinicQueue::lock();
                        $locked = Appointment::whereKey($appointment->id)->lockForUpdate()->first();
                        if (!$locked || $locked->status !== 'pending' || $locked->appointment_date->toDateString() >= today('Asia/Manila')->toDateString()) {
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
        $lateMinutes = config('checkin.checkin_late_minutes', 30);
        $slot = Carbon::createFromFormat(
            '!Y-m-d g:i A',
            $appointment->appointment_date->format('Y-m-d') . ' ' . $appointment->time_slot,
            'Asia/Manila'
        );
        return $slot->copy()->addMinutes($lateMinutes);
    }

    /**
     * Get the check-in opening time for an appointment.
     * Returns a Carbon instance in Asia/Manila timezone.
     */
    public function getCheckinOpening(Appointment $appointment): Carbon
    {
        $earlyMinutes = config('checkin.checkin_early_minutes', 15);
        $slot = Carbon::createFromFormat(
            '!Y-m-d g:i A',
            $appointment->appointment_date->format('Y-m-d') . ' ' . $appointment->time_slot,
            'Asia/Manila'
        );
        return $slot->copy()->subMinutes($earlyMinutes);
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
