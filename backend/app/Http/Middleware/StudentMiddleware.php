<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class StudentMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        if (auth()->user() && auth()->user()->role === 'student') {
            return $next($request);
        }

        return response()->json(['message' => 'Unauthorized. Student access required.'], 403);
    }
}
