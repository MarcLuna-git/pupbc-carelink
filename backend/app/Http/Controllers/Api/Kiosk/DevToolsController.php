<?php

namespace App\Http\Controllers\Api\Kiosk;

use App\Http\Controllers\Controller;
use App\Support\TimeGuard;
use Illuminate\Http\Request;

/**
 * Hidden kiosk settings page (/kiosk/settings) → Developer Tools. Protected by
 * the kiosk device token; "Remove time Guard" applies to the whole kiosk, see
 * App\Support\TimeGuard::kioskBypassed().
 */
class DevToolsController extends Controller
{
    public function show()
    {
        return response()->json([
            'success' => true,
            'data' => [
                'available' => (bool) config('dev_tools.enabled'),
                'time_guard_bypass' => TimeGuard::kioskBypassed(),
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

        TimeGuard::setKiosk($data['time_guard_bypass']);

        return response()->json([
            'success' => true,
            'message' => $data['time_guard_bypass']
                ? 'Time guard removed for the kiosk. Check-in is open all day.'
                : 'Time guard restored for the kiosk.',
            'data' => [
                'available' => true,
                'time_guard_bypass' => $data['time_guard_bypass'],
            ],
        ]);
    }

    /**
     * Read-only password check for the hidden /kiosk/dev demo mode.
     * Does not touch the database or mutate TimeGuard state.
     */
    public function verifyPassword(Request $request)
    {
        abort_unless(config('dev_tools.enabled'), 403, 'Developer Tools are disabled.');

        $data = $request->validate([
            'password' => 'required|string|max:255',
        ]);

        if (!hash_equals((string) config('dev_tools.password'), (string) $data['password'])) {
            return response()->json([
                'success' => false,
                'message' => 'Incorrect admin password.',
                'errors' => ['password' => ['Incorrect admin password.']],
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Kiosk demo mode unlocked.',
        ]);
    }
}
