<?php

namespace App\Services;

use App\Models\Appointment;
use Illuminate\Support\Facades\DB;

class AppointmentExpiry
{
    /** Expire pending appointments whose date has passed. Returns the count. */
    public function run(): int
    {
        $count = 0;

        Appointment::where('status', 'pending')
            ->whereDate('appointment_date', '<', today('Asia/Manila')->toDateString())
            ->orderBy('id')
            ->chunkById(100, function ($appointments) use (&$count) {
                foreach ($appointments as $appointment) {
                    DB::transaction(function () use ($appointment, &$count) {
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
}
