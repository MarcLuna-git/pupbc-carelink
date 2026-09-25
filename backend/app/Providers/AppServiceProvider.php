<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Schema;
use App\Repositories\Contracts\UserRepositoryInterface;
use App\Repositories\Contracts\EmailVerificationRepositoryInterface;
use App\Repositories\Eloquent\UserRepository;
use App\Repositories\Eloquent\EmailVerificationRepository;

class AppServiceProvider extends ServiceProvider
{
    public function register()
    {
        $this->app->bind(UserRepositoryInterface::class, UserRepository::class);
        $this->app->bind(EmailVerificationRepositoryInterface::class, EmailVerificationRepository::class);
    }

    public function boot()
    {
        \Illuminate\Support\Facades\Event::listen(
            \Illuminate\Mail\Events\MessageSending::class,
            function ($event) {
                if (!config('mail.test_mode')) {
                    return;
                }
                $recipient = config('mail.test_recipient');
                if (!is_string($recipient) || !filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
                    throw new \RuntimeException('A valid staging email recipient is required.');
                }
                // Override every envelope recipient, including CC/BCC, before transport.
                $event->message->setTo([$recipient]);
                $event->message->setCc([]);
                $event->message->setBcc([]);
                \Illuminate\Support\Facades\Log::info('Email recipient overridden for staging testing.');
            }
        );

        // Iwas sa MySQL/MariaDB index-length error.
        Schema::defaultStringLength(191);
    }
}
