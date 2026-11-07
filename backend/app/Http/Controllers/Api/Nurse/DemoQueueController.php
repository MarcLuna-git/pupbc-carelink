<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use App\Support\DemoQueue;
use Illuminate\Http\Request;

/*
 * Consultation → Queue list → Options → Developer tools. One looping demo patient for
 * walking through the queue (see App\Support\DemoQueue).
 */
class DemoQueueController extends Controller
{
    public function show()
    {
        return response()->json(['success' => true, 'data' => $this->state()]);
    }

    public function update(Request $request)
    {
        abort_unless(config('dev_tools.enabled'), 403, 'Developer Tools are disabled.');
        $data = $request->validate([
            'enabled' => 'required|boolean',
            'password' => 'nullable|string|max:255',
        ]);
        // Same rule as Settings → Developer Tools: only turning it on needs the password.
        if ($data['enabled'] && !hash_equals((string) config('dev_tools.password'), (string) ($data['password'] ?? ''))) {
            return response()->json([
                'success' => false,
                'message' => 'Incorrect developer password.',
                'errors' => ['password' => ['Incorrect developer password.']],
            ], 422);
        }
        DemoQueue::set($data['enabled'], $request->user()->id);
        return response()->json([
            'success' => true,
            'message' => $data['enabled'] ? 'Demo patients added to the queue.' : 'Demo patients removed.',
            'data' => $this->state(),
        ]);
    }

    public function reset(Request $request)
    {
        abort_unless(DemoQueue::enabled(), 409, 'Turn on the demo patients first.');
        DemoQueue::reset($request->user()->id);
        return response()->json(['success' => true, 'message' => 'Demo patients reset to waiting.', 'data' => $this->state()]);
    }

    private function state(): array
    {
        return [
            'available' => (bool) config('dev_tools.enabled'),
            'enabled' => DemoQueue::enabled(),
            'student_ids' => DemoQueue::studentIds(),
        ];
    }
}
