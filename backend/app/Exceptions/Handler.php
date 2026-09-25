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
            Log::channel('daily')->error($e->getMessage(), [
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'url' => request()->url(),
                'method' => request()->method(),
                'user_id' => auth()->id() ?? 'guest',
                'user_type' => auth()->check() ? (auth()->user()->role ?? 'unknown') : 'guest',
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
