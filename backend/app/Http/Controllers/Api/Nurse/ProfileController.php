<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function update(Request $request)
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100', 'regex:/^[\pL\s\-\'.]+$/u'],
            'last_name' => ['required', 'string', 'max:100', 'regex:/^[\pL\s\-\'.]+$/u'],
        ], [
            'first_name.required' => 'First name is required.',
            'first_name.regex' => 'First name may contain letters, spaces, apostrophes, periods, and hyphens only.',
            'last_name.required' => 'Last name is required.',
            'last_name.regex' => 'Last name may contain letters, spaces, apostrophes, periods, and hyphens only.',
        ]);
        $request->user()->update($data);
        return response()->json(['success' => true, 'data' => $request->user()->fresh(), 'message' => 'Profile updated.']);
    }

    /**
     * On duty / Off duty switch from the nurse account menu.
     */
    public function updateDutyStatus(Request $request)
    {
        $data = $request->validate(['on_duty' => 'required|boolean']);
        $user = $request->user();
        $user->forceFill(['on_duty' => (bool) $data['on_duty']])->save();

        return response()->json([
            'success' => true,
            'data' => $user->fresh(),
            'message' => $data['on_duty'] ? 'You are now on duty.' : 'You are now off duty.',
        ]);
    }
}
