<?php

namespace App\Http\Middleware;

use Closure;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CompressResponse
{
    // Smaller bodies are not worth the CPU or the extra header bytes.
    private const MIN_BYTES = 1024;

    // `php artisan serve` (production on Render) has no web server in front of
    // it to compress, so large JSON lists (students, appointments, records)
    // would go over the wire as plain text. Where Apache/nginx already
    // compresses, Content-Encoding is set and this does nothing.
    public function handle($request, Closure $next)
    {
        $response = $next($request);

        if (
            !function_exists('gzencode')
            || $response instanceof StreamedResponse
            || $response instanceof BinaryFileResponse
            || $request->isMethod('HEAD')
            || $response->headers->has('Content-Encoding')
            || !in_array($response->getStatusCode(), [200, 201, 202, 400, 401, 403, 404, 409, 422, 429, 500], true)
            || !str_contains((string) $request->headers->get('Accept-Encoding'), 'gzip')
        ) {
            return $response;
        }

        $type = (string) $response->headers->get('Content-Type');
        $content = $response->getContent();

        // Vary tells shared caches the body depends on Accept-Encoding.
        if (str_contains($type, 'json') || str_starts_with($type, 'text/')) {
            $response->setVary('Accept-Encoding', false);
        } else {
            return $response;
        }

        if (!is_string($content) || strlen($content) < self::MIN_BYTES) {
            return $response;
        }

        $compressed = gzencode($content, 6);

        if ($compressed === false) {
            return $response;
        }

        $response->setContent($compressed);
        $response->headers->set('Content-Encoding', 'gzip');
        $response->headers->set('Content-Length', (string) strlen($compressed));

        return $response;
    }
}
