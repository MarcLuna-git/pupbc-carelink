<?php

namespace App\Http\Middleware;

use Closure;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SetContentLength
{
    // `php artisan serve` (production on Render) keeps the connection open
    // until the script ends, including terminate callbacks such as deferred
    // emails. With an explicit Content-Length the client knows the body is
    // complete as soon as it arrives, so post-response work never shows up
    // as request latency or a frontend timeout.
    public function handle($request, Closure $next)
    {
        $response = $next($request);

        if ($response instanceof StreamedResponse || $response instanceof BinaryFileResponse) {
            return $response;
        }

        $content = $response->getContent();

        if (is_string($content) && !$response->headers->has('Content-Length') && !$response->headers->has('Transfer-Encoding')) {
            $response->headers->set('Content-Length', (string) strlen($content));
        }

        return $response;
    }
}
