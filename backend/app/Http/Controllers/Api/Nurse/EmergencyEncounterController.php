<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use App\Models\EmergencyEncounter;
use App\Models\User;
use Illuminate\Http\Request;

class EmergencyEncounterController extends Controller
{
    public function index($studentId)
    {
        $student = User::where('role', 'student')->findOrFail($studentId);
        return response()->json([
            'success' => true,
            'data' => EmergencyEncounter::with('nurse:id,first_name,last_name')
                ->where('user_id', $student->id)->latest('incident_datetime')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'student_id' => 'required|uuid',
            'incident_datetime' => 'required|date',
            'reason' => 'required|string|max:1000',
            'symptoms' => 'nullable|string|max:2000',
            'assessment' => 'nullable|string|max:2000',
            'intervention' => 'nullable|string|max:2000',
            'disposition' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:2000',
        ]);

        $student = User::where('role', 'student')->findOrFail($data['student_id']);
        $data['user_id'] = $student->id;
        $data['recorded_by'] = $request->user()->id;
        unset($data['student_id']);

        return response()->json([
            'success' => true,
            'data' => EmergencyEncounter::create($data)->load('student:id,student_id,first_name,last_name', 'nurse:id,first_name,last_name'),
        ], 201);
    }
}
