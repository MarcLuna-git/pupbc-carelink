<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class NurseMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        if (auth()->user() && auth()->user()->role === 'nurse') {
            return $next($request);
        }

        return response()->json(['message' => 'Unauthorized. Nurse access required.'], 403);
    }
}
