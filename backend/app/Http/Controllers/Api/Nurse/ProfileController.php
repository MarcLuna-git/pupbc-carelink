<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function update(Request $request)
    {
        $data = $request->validate(['first_name' => 'required|string|max:100', 'last_name' => 'required|string|max:100']);
        $request->user()->update($data);
        return response()->json(['success' => true, 'data' => $request->user()->fresh(), 'message' => 'Profile updated.']);
    }
}
