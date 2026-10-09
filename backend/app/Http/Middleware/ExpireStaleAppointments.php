<?php

namespace App\Http\Middleware;

use App\Services\AppointmentExpiry;
use Closure;
use Illuminate\Support\Facades\Log;

class ExpireStaleAppointments
{
    // Request-triggered fallback; background processing needs a scheduler runner.
    public function handle($request, Closure $next)
    {
        // Public page reads, health probes, and authentication do not use appointments.
        // Leave expiry to clinic requests, avoiding maintenance during login.
        if ($request->is('api/health', 'api/auth/*', 'api/announcements', 'api/announcements/*', 'api/kiosk/session')) {
            return $next($request);
        }

        // Do not cache once per day: each slot has its own exact deadline.
        // Database locks and status rechecks make simultaneous runs idempotent.
        try {
            app(AppointmentExpiry::class)->run();
        } catch (\Throwable $e) {
            Log::error('Lazy appointment expiry failed.', ['exception_class' => get_class($e)]);
        }

        return $next($request);
    }
}
