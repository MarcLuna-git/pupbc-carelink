<?php

namespace App\Http\Middleware;

use Closure;

class KioskDevice
{
    public function handle($request, Closure $next)
    {
        $expected = (string) config('kiosk.device_token');
        if (strlen($expected) < 32) {
            return response()->json(['message' => 'Kiosk device access is not configured.'], 503);
        }
        if (!hash_equals($expected, (string) $request->header('X-Kiosk-Token'))) {
            return response()->json(['message' => 'Authorized clinic device required.'], 403);
        }
        return $next($request);
    }
}
