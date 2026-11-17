<?php

namespace App\Mail;

use App\Models\Appointment;
use Illuminate\Mail\Mailable;
use InvalidArgumentException;

class StudentAppointmentStatusMail extends Mailable
{
    public $appointmentId;
    public $referenceNumber;
    public $appointmentDate;
    public $timeSlot;
    public $status;
    public $event;
    public $reason;
    public $title;
    public $eventMessage;

    public function __construct(Appointment $appointment, ?string $event = null)
    {
        $this->event = $event ?? $appointment->status;
        $titles = [
            'pending' => 'Appointment request received',
            'approved' => 'Appointment approved',
            'rejected' => 'Appointment rejected',
            'cancelled' => 'Appointment cancelled',
            'rescheduled' => 'Appointment rescheduled',
            'expired' => 'Appointment expired',
            'called' => 'The clinic is calling you',
        ];
        if (!isset($titles[$this->event])) {
            throw new InvalidArgumentException('Unsupported appointment email event.');
        }
        $this->title = $titles[$this->event];
        $this->reason = $this->event === 'rejected' ? $appointment->rejection_reason
            : ($this->event === 'cancelled' ? $appointment->cancellation_reason : null);
        $messages = [
            'pending' => 'Your appointment request is pending clinic approval. This email does not confirm approval.',
            'approved' => 'Your appointment has been approved by the clinic.',
            'rejected' => 'Your appointment request has been rejected by the clinic.',
            'cancelled' => $appointment->cancelled_by
                ? 'Your appointment has been cancelled by the clinic.'
                : 'Your appointment has been cancelled at your request.',
            'rescheduled' => 'The clinic has rescheduled your appointment. Please review the updated schedule below.',
            'expired' => 'Your pending appointment expired because its appointment date has passed.',
            // Sent when the nurse calls the student from the queue (KioskController::callNext).
            'called' => 'The clinic is calling '
                . ($appointment->queue_number ? 'queue number ' . $appointment->queue_number : 'you')
                . '. Please go to the clinic now.',
        ];
        $this->eventMessage = $messages[$this->event];

        $this->appointmentId = $appointment->id;
        $this->referenceNumber = $appointment->reference_number;
        $this->appointmentDate = $appointment->appointment_date->format('M j, Y');
        $this->timeSlot = $appointment->time_slot;
        $this->status = $appointment->status;
    }

    public function build()
    {
        return $this->subject($this->title . ' - PUPBC CareLink')
            ->view('emails.student-appointment-status');
    }
}
