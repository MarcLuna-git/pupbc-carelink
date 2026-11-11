<?php

namespace App\Services;

use App\Mail\NurseNotificationMail;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Emails a nurse when one of the portal's actionable notifications is created
 * for them (a new booking, a student cancelling, medicine stock or expiry).
 * The in-app notification stays the source of truth; the email is a copy.
 */
class NurseEmailNotifier
{
    public const TYPES = [
        'appointment_booked',
        'appointment_cancelled_by_student',
        'medicine_low_stock',
        'medicine_out_of_stock',
        'medicine_expiring_soon',
        'medicine_expires_today',
        'medicine_expired',
    ];

    public function afterCreate(Notification $notification): void
    {
        if (!config('mail.nurse_notifications') || !in_array($notification->type, self::TYPES, true)) {
            return;
        }

        $nurse = User::where('role', 'nurse')->find($notification->user_id);
        if (!$nurse || !filter_var($nurse->email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $recipient = $nurse->email;
        $mail = new NurseNotificationMail($notification->id, $notification->type, (string) $notification->title, (string) $notification->message);

        DB::afterCommit(function () use ($recipient, $mail) {
            // Same rule as the student emails: SMTP can take seconds, so over HTTP it is
            // sent after the response has gone out; console runs (scheduler, tests) send now.
            if (app()->runningInConsole()) {
                $this->send($recipient, $mail);
                return;
            }

            app()->terminating(fn () => $this->send($recipient, $mail));
        });
    }

    private function send(string $recipient, NurseNotificationMail $mail): void
    {
        try {
            Mail::to($recipient)->send($mail);
        } catch (Throwable $exception) {
            // The notification is already saved; a mail failure must never fail the request.
            Log::error('Nurse notification email delivery failed.', [
                'notification_id' => $mail->notificationId,
                'type' => $mail->type,
                'exception_class' => get_class($exception),
            ]);
        }
    }
}
