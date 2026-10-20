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
            // SMTP takes seconds (TLS + auth) and can stall up to MAIL_TIMEOUT.
            // During a web request, send it AFTER the response has gone out
            // (kernel terminate; the client already has the full body thanks
            // to SetContentLength), so a slow relay never delays — or times
            // out — the student's booking/cancel request. Console runs (tests,
            // scheduled expiry) have no response to wait on: send right away.
            if (app()->runningInConsole()) {
                $this->send($recipient, $mail);
                return;
            }

            app()->terminating(fn () => $this->send($recipient, $mail));
        });
    }

    private function send(string $recipient, StudentAppointmentStatusMail $mail): void
    {
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
    }
}
