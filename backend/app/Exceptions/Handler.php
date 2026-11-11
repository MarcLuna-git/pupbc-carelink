<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Support\Facades\Log;
use Throwable;

class Handler extends ExceptionHandler
{
    /** @var array<int, class-string<Throwable>> */
    protected $dontReport = [
    ];

    /** @var array<int, string> */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
        'otp',
    ];

    /** @return void */
    public function register()
    {
        $this->reportable(function (Throwable $e) {
            // Looking up the signed-in user queries the database. When the
            // database is the thing that failed, that lookup throws again from
            // inside the reporter, and the response then leaves through PHP's
            // fallback handler without any of the security headers.
            try {
                $userId = auth()->id() ?? 'guest';
                $userType = auth()->check() ? (auth()->user()->role ?? 'unknown') : 'guest';
            } catch (Throwable $lookupFailure) {
                $userId = 'unavailable';
                $userType = 'unavailable';
            }

            Log::channel('daily')->error($e->getMessage(), [
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'url' => request()->url(),
                'method' => request()->method(),
                'user_id' => $userId,
                'user_type' => $userType,
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'input' => $this->sanitizeInput(request()->except(['password', 'password_confirmation', 'token'])),
                'trace' => collect($e->getTrace())->take(5)->map(function ($trace) {
                    return [
                        'file' => $trace['file'] ?? 'unknown',
                        'line' => $trace['line'] ?? 0,
                        'function' => $trace['function'] ?? 'unknown',
                        'class' => $trace['class'] ?? 'N/A',
                    ];
                })->toArray(),
            ]);
        });

        $this->renderable(function (\Illuminate\Auth\AuthenticationException $e, $request) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated. Please login again.',
                'error_code' => 'AUTH_REQUIRED',
            ], 401);
        });

        $this->renderable(function (\Symfony\Component\HttpKernel\Exception\NotFoundHttpException $e, $request) {
            return response()->json([
                'success' => false,
                'message' => 'Resource not found.',
                'error_code' => 'NOT_FOUND',
            ], 404);
        });

        $this->renderable(function (\Illuminate\Validation\ValidationException $e, $request) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'error_code' => 'VALIDATION_ERROR',
                'errors' => $e->errors(),
            ], 422);
        });

        $this->renderable(function (\Symfony\Component\HttpKernel\Exception\HttpException $e, $request) {
            if ($e->getStatusCode() === 429) {
                return response()->json([
                    'success' => false,
                    'message' => 'Too many requests. Please try again later.',
                    'error_code' => 'RATE_LIMITED',
                    'retry_after' => $e->getHeaders()['Retry-After'] ?? 60,
                ], 429, $e->getHeaders());
            }
        });

        // Database failures must never reach the client with their SQL, file
        // paths or stack trace, even when APP_DEBUG is on. The full error is
        // already written to the daily log by the reportable callback above.
        $this->renderable(function (\PDOException $e, $request) {
            if ($this->isDatabaseUnavailable($e)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Service temporarily unavailable. Please try again shortly.',
                    'error_code' => 'SERVICE_UNAVAILABLE',
                ], 503, ['Retry-After' => 30]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Something went wrong. Please try again.',
                'error_code' => 'SERVER_ERROR',
            ], 500);
        });
    }

    /** True when the database server itself cannot be reached (outage, not a query bug). */
    private function isDatabaseUnavailable(\PDOException $e): bool
    {
        $message = strtolower($e->getMessage());

        $markers = [
            'sqlstate[hy000] [2002]',
            'sqlstate[hy000] [2003]',
            'sqlstate[hy000] [2006]',
            'sqlstate[hy000] [1040]',
            'sqlstate[hy000] [1130]',
            'sqlstate[08',
            'connection refused',
            'actively refused',
            'could not connect',
            'server has gone away',
            'connection timed out',
            'too many connections',
        ];

        foreach ($markers as $marker) {
            if (strpos($message, $marker) !== false) {
                return true;
            }
        }

        return false;
    }

    private function sanitizeInput(array $input): array
    {
        $sensitiveFields = ['password', 'password_confirmation', 'current_password', 'new_password', 'token', 'secret', 'api_key', 'resend_api_key', 'otp'];
        
        foreach ($input as $field => $value) {
            if (in_array(strtolower($field), $sensitiveFields, true)) {
                $input[$field] = '***REDACTED***';
            } elseif (is_array($value)) {
                $input[$field] = $this->sanitizeInput($value);
            }
        }

        return $input;
    }
}
