<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use App\Models\AppointmentCheckin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/*
 * Consultation → visit → "Save progress": the unfinished consultation form of one visit,
 * stored on the server (not in the browser) so it can be continued on any nurse device.
 * It is not part of the patient's records; ConsultationController::store removes it.
 */
class ConsultationDraftController extends Controller
{
    public function show($checkinId)
    {
        $draft = DB::table('consultation_drafts as d')->leftJoin('users as u', 'u.id', '=', 'd.saved_by')
            ->where('d.checkin_id', $checkinId)
            ->first(['d.data', 'd.updated_at', 'u.first_name', 'u.last_name']);
        return response()->json(['success' => true, 'data' => $draft ? $this->present($draft) : null]);
    }

    public function update(Request $request, $checkinId)
    {
        $checkin = AppointmentCheckin::findOrFail($checkinId);
        abort_if($checkin->consultation()->exists(), 409, 'This visit already has a consultation.');
        $data = $request->validate(['data' => 'required|array'])['data'];
        $json = json_encode($data);
        abort_if(strlen($json) > 200000, 422, 'This draft is too large to save.');

        $values = ['data' => $json, 'saved_by' => $request->user()->id, 'updated_at' => now()];
        $saved = DB::table('consultation_drafts')->where('checkin_id', $checkin->id)->update($values);
        if (!$saved) DB::table('consultation_drafts')->insert($values + ['checkin_id' => $checkin->id, 'created_at' => now()]);
        return $this->show($checkin->id);
    }

    public function destroy($checkinId)
    {
        DB::table('consultation_drafts')->where('checkin_id', $checkinId)->delete();
        return response()->json(['success' => true]);
    }

    private function present($draft): array
    {
        return [
            'data' => json_decode($draft->data, true),
            'saved_at' => \Carbon\Carbon::parse($draft->updated_at)->toJSON(),
            'saved_by' => trim(($draft->first_name ?? '') . ' ' . ($draft->last_name ?? '')) ?: null,
        ];
    }
}
