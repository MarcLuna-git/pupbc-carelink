<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Consultation;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function stats()
    {
        $userId = auth()->id();
        $appointmentCounts = Appointment::where('user_id', $userId)
            ->selectRaw("
                COUNT(CASE WHEN appointment_date >= ? AND status = 'approved' THEN 1 END) AS upcoming_appointments,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_appointments
            ", [now('Asia/Manila')->toDateString()])
            ->first();
        
        return response()->json([
            'success' => true,
            'data' => [
                'upcoming_appointments' => (int) ($appointmentCounts->upcoming_appointments ?? 0),
                'total_consultations' => Consultation::where('user_id', $userId)->count(),
                'medical_certificates' => 0,
                'pending_appointments' => (int) ($appointmentCounts->pending_appointments ?? 0),
            ]
        ]);
    }

    public function upcomingAppointments()
    {
        $appointments = Appointment::where('user_id', auth()->id())
            ->whereDate('appointment_date', '>=', now('Asia/Manila')->toDateString())
            ->where('status', 'approved')
            ->orderBy('appointment_date')
            ->limit(5)
            ->get();

        return response()->json(['success' => true, 'data' => $appointments]);
    }

    public function recentConsultations()
    {
        $consultations = Consultation::where('user_id', auth()->id())
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get();

        return response()->json(['success' => true, 'data' => $consultations]);
    }
}
