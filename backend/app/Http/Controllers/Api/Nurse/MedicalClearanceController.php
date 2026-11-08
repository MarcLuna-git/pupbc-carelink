<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\MedicalClearance;
use Illuminate\Http\Request;

/* Nurse portal → Documents: batch Medical Clearance certifications. */
class MedicalClearanceController extends Controller
{
    public function index()
    {
        $clearances = MedicalClearance::with('issuer:id,first_name,last_name')
            ->orderByDesc('certified_date')->orderByDesc('created_at')->limit(200)->get();

        return response()->json(['success' => true, 'data' => $clearances]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'activity' => 'required|string|max:191',
            'venue' => 'required|string|max:191',
            'group_label' => 'nullable|string|max:100',
            'activity_date' => 'required|date',
            'certified_date' => 'required|date',
            'students' => 'required|array|min:1|max:300',
            'students.*' => 'required|string|max:191',
        ], [
            'activity.required' => 'Enter the activity.',
            'venue.required' => 'Enter the venue.',
            'activity_date.required' => 'Enter the date of the activity.',
            'students.required' => 'Add at least one student.',
            'students.min' => 'Add at least one student.',
        ]);

        // Tidy the typed names: trimmed, no blanks, no repeats (case-insensitive), A to Z.
        $names = collect($data['students'])->map(fn ($name) => trim(preg_replace('/\s+/', ' ', $name)))
            ->filter()->unique(fn ($name) => mb_strtolower($name))->sort(SORT_NATURAL | SORT_FLAG_CASE)->values()->all();
        abort_if(!$names, 422, 'Add at least one student.');

        $clearance = MedicalClearance::create(array_merge($data, ['students' => $names, 'issued_by' => auth()->id()]));
        AuditLog::create([
            'user_id' => auth()->id(), 'action' => 'medical_clearance_created',
            'description' => "Medical clearance issued for {$clearance->activity} ({$clearance->id}), " . count($names) . ' students',
            'ip_address' => request()->ip(),
        ]);

        return response()->json(['success' => true, 'data' => $clearance->load('issuer:id,first_name,last_name'), 'message' => 'Medical clearance saved'], 201);
    }

    public function destroy($id)
    {
        $clearance = MedicalClearance::findOrFail($id);
        $clearance->delete();
        AuditLog::create([
            'user_id' => auth()->id(), 'action' => 'medical_clearance_deleted',
            'description' => "Medical clearance deleted for {$clearance->activity} ({$clearance->id})",
            'ip_address' => request()->ip(),
        ]);

        return response()->json(['success' => true, 'message' => 'Medical clearance deleted']);
    }
}
