<?php

namespace App\Services;

use App\Mail\StudentAppointmentStatusMail;
use App\Models\Appointment;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class StudentAppointmentMail
{
    public function afterCommit(Appointment $appointment, ?string $event = null): void
    {
        // Capture the recipient and event details before a later status change.
        $recipient = $appointment->user()->withTrashed()->firstOrFail()->email;
        $mail = new StudentAppointmentStatusMail($appointment, $event);

        DB::afterCommit(function () use ($recipient, $mail) {
            try {
                Mail::to($recipient)->send($mail);
            } catch (Throwable $exception) {
                // The appointment is already committed. Do not turn a transport
                // failure into a failed booking response or retry the transaction.
                Log::error('Student appointment email delivery failed.', [
                    'appointment_id' => $mail->appointmentId,
                    'status' => $mail->status,
                    'event' => $mail->event,
                    'exception_class' => get_class($exception),
                ]);
            }
        });
    }
}
