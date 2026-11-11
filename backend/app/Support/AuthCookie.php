<?php

namespace App\Support;

use Symfony\Component\HttpFoundation\Cookie;

/*
| The sign-in token (JWT) travels in an httpOnly cookie, one per portal, so the
| Student and Nurse portals can stay signed in side by side. Page scripts cannot
| read an httpOnly cookie, so an injected script (XSS) cannot steal the session.
| The browser says which portal a request is for with the X-Portal header; see
| AuthenticateFromCookie.
*/
class AuthCookie
{
    public const PORTALS = ['student', 'nurse'];

    public static function name(string $portal): string
    {
        return "carelink_{$portal}_session";
    }

    public static function portalFor($user): string
    {
        return ($user->role ?? null) === 'nurse' ? 'nurse' : 'student';
    }

    // The portal a request names in X-Portal, or null.
    public static function requestedPortal($request): ?string
    {
        $portal = $request->header('X-Portal');

        return in_array($portal, self::PORTALS, true) ? $portal : null;
    }

    public static function make(string $token, string $portal): Cookie
    {
        $ttl = (int) config('jwt.ttl');

        return self::cookie($portal, $token, $ttl > 0 ? now()->addMinutes($ttl) : 0);
    }

    public static function forget(string $portal): Cookie
    {
        return self::cookie($portal, '', now()->subYear());
    }

    private static function cookie(string $portal, string $value, $expires): Cookie
    {
        // Path /api: only API requests carry it. SameSite=Strict: never sent on
        // requests started by another site. Secure by default; set
        // AUTH_COOKIE_SECURE=false only for a plain-http test setup that is not
        // localhost (browsers accept Secure cookies on http://localhost).
        return Cookie::create(
            self::name($portal),
            $value,
            $expires,
            '/api',
            null,
            (bool) config('jwt.cookie_secure', true),
            true,
            false,
            Cookie::SAMESITE_STRICT
        );
    }
}
