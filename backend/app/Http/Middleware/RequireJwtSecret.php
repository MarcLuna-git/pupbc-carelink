<?php

namespace App\Http\Middleware;

use Closure;

class RequireJwtSecret
{
    public function handle($request, Closure $next)
    {
        if ($request->is('api/auth/*', 'api/student/*', 'api/nurse/*', 'api/notifications*') && strlen((string) config('jwt.secret')) < 32) {
            return response()->json(['message' => 'Authentication is not configured.'], 503);
        }
        return $next($request);
    }
}
