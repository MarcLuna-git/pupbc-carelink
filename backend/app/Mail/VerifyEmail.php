<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class VerifyEmail extends Mailable
{
    use Queueable, SerializesModels;

    public $user;
    public $otp;

    public function __construct(User $user, string $otp)
    {
        $this->user = $user;
        $this->otp = $otp;
    }

    public function build()
    {
        $mailer = $this->mailer ?: config('mail.default');
        if (in_array(config("mail.mailers.{$mailer}.transport"), ['log', 'failover'], true)) {
            throw new \RuntimeException('Registration OTP requires a mailer that does not log email bodies.');
        }

        return $this->from(config('mail.from.address'), config('mail.from.name'))
                    ->subject('Email Verification - PUPBC CareLink')
                    ->markdown('emails.verify-email')
                    ->with([
                        'user' => $this->user,
                        'otp' => $this->otp,
                    ]);
    }
}
