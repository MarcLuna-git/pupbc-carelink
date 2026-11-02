<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use App\Support\ClinicSettings;
use Illuminate\Http\Request;

/*
 * Consultation → Queue list → Options. Clinic-wide: every nurse device uses the same arrival time.
 */
class QueueSettingsController extends Controller
{
    public function show()
    {
        return response()->json(['success' => true, 'data' => $this->settings()]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'call_timeout_seconds' => 'required|integer|min:' . ClinicSettings::MIN_CALL_TIMEOUT_SECONDS . '|max:' . ClinicSettings::MAX_CALL_TIMEOUT_SECONDS,
        ]);
        ClinicSettings::setCallTimeoutSeconds($data['call_timeout_seconds'], $request->user()->id);
        return response()->json(['success' => true, 'message' => 'Arrival time updated.', 'data' => $this->settings()]);
    }

    private function settings(): array
    {
        return [
            'call_timeout_seconds' => ClinicSettings::callTimeoutSeconds(),
            'default_call_timeout_seconds' => ClinicSettings::DEFAULT_CALL_TIMEOUT_SECONDS,
            'min_call_timeout_seconds' => ClinicSettings::MIN_CALL_TIMEOUT_SECONDS,
            'max_call_timeout_seconds' => ClinicSettings::MAX_CALL_TIMEOUT_SECONDS,
        ];
    }
}
