<?php
namespace App\Http\Controllers\Api\Kiosk;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\AppointmentCheckin;
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
    public function todayCheckins()
    {
        // Queue list → Options → Developer tools: put the demo patient back in line.
        \App\Support\DemoQueue::ensure();
        // Today's finished visits leave the live queue, so the summary cards count them separately.
        $today = AppointmentCheckin::where('created_at', '>=', today())->where('created_at', '<', today()->addDay())->where('is_walk_in', false);
        return response()->json(['success' => true, 'data' => ClinicQueue::ordered()->get(), 'stats' => [
            'completed_today' => (clone $today)->where('status', 'completed')->count(),
            'no_show_today' => (clone $today)->where('status', 'no_show')->count(),
        ], 'server_time' => now()->toIso8601String(), 'call_timeout_seconds' => \App\Support\ClinicSettings::callTimeoutSeconds(),
            'demo_user_ids' => \App\Support\DemoQueue::enabled() ? \App\Support\DemoQueue::userIds() : []]);
    }
    public function getAppointment($reference)
    {
        $appointment = Appointment::where('reference_number', $reference)->where('status', 'approved')->whereDate('appointment_date', today('Asia/Manila')->toDateString())->firstOrFail();
        return response()->json(['success' => true, 'data' => ['service' => $appointment->service, 'appointment_date' => $appointment->appointment_date->toDateString(), 'time_slot' => $appointment->time_slot]]);
    }
}
