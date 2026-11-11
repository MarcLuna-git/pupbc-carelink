<?php

namespace App\Http\Middleware;

use App\Support\AuthCookie;
use Closure;

class AuthenticateFromCookie
{
    // Turns the portal's httpOnly session cookie into the Bearer header the JWT
    // guard reads, so the rest of the API is unchanged. Only when the request
    // names its portal in X-Portal: another site cannot add that header without
    // passing CORS, so a cross-site request (CSRF) never uses the cookie.
    // An explicit Authorization header (tests, API clients) always wins.
    public function handle($request, Closure $next)
    {
        $portal = AuthCookie::requestedPortal($request);

        if ($portal && !$request->headers->has('Authorization')) {
            $token = $request->cookies->get(AuthCookie::name($portal));

            if (is_string($token) && $token !== '') {
                $request->headers->set('Authorization', 'Bearer ' . $token);
            }
        }

        return $next($request);
    }
}
