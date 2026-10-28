<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;

class NurseNotificationMail extends Mailable
{
    public $notificationId;
    public $type;
    public $title;
    public $body;

    public function __construct(string $notificationId, string $type, string $title, string $body)
    {
        $this->notificationId = $notificationId;
        $this->type = $type;
        $this->title = $title;
        $this->body = $body;
    }

    public function build()
    {
        return $this->subject($this->title . ' - PUPBC CareLink')
            ->view('emails.nurse-notification');
    }
}
