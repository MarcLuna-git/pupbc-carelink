<?php

namespace App\Http\Middleware;

use App\Services\AppointmentExpiry;
use Closure;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class ExpireStaleAppointments
{
    // Walang cron sa Render free, kaya ang unang API request ng araw ang nag-e-expire.
    // ponytail: first request of the day pays for the expiry run; move to a cron/worker if volume grows.
    public function handle($request, Closure $next)
    {
        $key = 'appointments:expired:' . today('Asia/Manila')->toDateString();

        if (Cache::add($key, true, now()->addDay())) {
            try {
                app(AppointmentExpiry::class)->run();
            } catch (\Throwable $e) {
                Cache::forget($key);
                Log::error('Lazy appointment expiry failed.', ['exception_class' => get_class($e)]);
            }
        }

        return $next($request);
    }
}
