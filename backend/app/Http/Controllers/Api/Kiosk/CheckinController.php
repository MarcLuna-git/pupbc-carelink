<?php
namespace App\Http\Controllers\Api\Kiosk;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Services\ClinicQueue;
use Illuminate\Http\Request;
class CheckinController extends Controller
{
    public function verifyQR(Request $request)
    {
        $request->validate(['qr_hash' => 'required|string']);
        $request->merge(['method' => 'qr', 'student_id' => $request->input('student_id', $request->qr_hash)]);
        return app(KioskController::class)->lookup($request);
    }
    public function checkin(Request $request) { return response()->json(['message' => 'Use scheduled check-in with triage.'], 410); }
    public function todayCheckins() { return response()->json(['success' => true, 'data' => ClinicQueue::ordered()->get()]); }
    public function getAppointment($reference)
    {
        $appointment = Appointment::where('reference_number', $reference)->where('status', 'approved')->whereDate('appointment_date', today('Asia/Manila')->toDateString())->firstOrFail();
        return response()->json(['success' => true, 'data' => ['service' => $appointment->service, 'appointment_date' => $appointment->appointment_date->toDateString(), 'time_slot' => $appointment->time_slot]]);
    }
}
