<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Support\TimeGuard;
use Illuminate\Http\Request;

/**
 * Student → Settings → Developer Tools.
 */
class DevToolsController extends Controller
{
    public function show()
    {
        return response()->json([
            'success' => true,
            'data' => [
                'available' => (bool) config('dev_tools.enabled'),
                'time_guard_bypass' => TimeGuard::bypassed(auth()->user()),
            ],
        ]);
    }

    public function update(Request $request)
    {
        abort_unless(config('dev_tools.enabled'), 403, 'Developer Tools are disabled.');

        $data = $request->validate([
            'time_guard_bypass' => 'required|boolean',
            'password' => 'nullable|string|max:255',
        ]);

        // Only turning the bypass ON needs the password; turning it off is always allowed.
        if (
            $data['time_guard_bypass'] &&
            !hash_equals((string) config('dev_tools.password'), (string) ($data['password'] ?? ''))
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Incorrect developer password.',
                'errors' => ['password' => ['Incorrect developer password.']],
            ], 422);
        }

        TimeGuard::set(auth()->user(), $data['time_guard_bypass']);

        return response()->json([
            'success' => true,
            'message' => $data['time_guard_bypass']
                ? 'Time guard removed. Booking time rules are bypassed for your account.'
                : 'Time guard restored.',
            'data' => [
                'available' => true,
                'time_guard_bypass' => $data['time_guard_bypass'],
            ],
        ]);
    }
}
