<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Contracts\Debug\ExceptionHandler;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SecurityHeaders
{
    // Browser security headers for every backend response (OWASP ZAP passive
    // scan findings). The API only returns data, so nothing it sends should be
    // framed, sniffed into another type, or run as a page.
    public function handle($request, Closure $next)
    {
        // An exception thrown by a later global middleware (for example the
        // session lookup while the database is down) is normally rendered by
        // the kernel after this middleware has been skipped, so the error
        // response would go out without any of the headers below. Render it
        // here instead so error responses are covered too.
        try {
            $response = $next($request);
        } catch (\Throwable $e) {
            $handler = app(ExceptionHandler::class);
            $handler->report($e);
            $response = $handler->render($request, $e);
        }
        $headers = $response->headers;

        // PHP adds "X-Powered-By: PHP/x.y.z" when expose_php is on (XAMPP's
        // default); it only tells an attacker which PHP bugs to try.
        if (!headers_sent()) {
            header_remove('X-Powered-By');
        }
        $headers->remove('X-Powered-By');

        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('X-Frame-Options', 'DENY');
        $headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // JSON is never rendered as a document, so it may load nothing at all.
        // frame-ancestors and form-action are named because default-src does
        // not stand in for them.
        // Files (avatars, attachments) are left alone so a PDF still opens in
        // the browser's viewer.
        // A response with no body (the 204 answer to a CORS preflight, which
        // the browser sends before every cross-origin API call) gets the same
        // policy: there is nothing in it to load either.
        $bodiless = !$response instanceof StreamedResponse
            && !$response instanceof BinaryFileResponse
            && $response->getContent() === '';
        if ($bodiless || str_contains((string) $headers->get('Content-Type'), 'json')) {
            $headers->set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; form-action 'none'");
        }

        // Signed-in responses hold health records: keep them out of the browser
        // and proxy caches. Responses that chose to be public (avatars) keep
        // their own caching.
        if ($request->bearerToken()
            && !$response instanceof StreamedResponse
            && !$response instanceof BinaryFileResponse
            && !str_contains((string) $headers->get('Cache-Control'), 'public')) {
            $headers->set('Cache-Control', 'no-store, private');
        }

        // Production is HTTPS only (Render / cPanel). Not sent locally, where
        // http://localhost would otherwise be forced to HTTPS for a year.
        if (app()->environment('production') && str_starts_with((string) config('app.url'), 'https://')) {
            $headers->set('Strict-Transport-Security', 'max-age=31536000');
        }

        return $response;
    }
}
