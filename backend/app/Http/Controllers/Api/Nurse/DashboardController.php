<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Consultation;
use App\Models\User;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

class DashboardController extends Controller
{
    public function stats()
    {
        $stats = Cache::remember('nurse_dashboard_stats', 300, function() {
            $today = Carbon::today('Asia/Manila');
            
            return [
                'today_appointments' => Appointment::whereDate('appointment_date', $today)->count(),
                'pending_appointments' => Appointment::where('status', 'pending')->count(),
                'today_consultations' => Consultation::whereDate('created_at', $today)->count(),
                'total_students' => User::where('role', 'student')->count(),
                'upcoming_appointments' => Appointment::with('user:id,student_id,first_name,last_name')
                    ->where('status', 'approved')
                    ->whereDate('appointment_date', '>=', $today)
                    ->orderBy('appointment_date')
                    ->limit(5)
                    ->get(),
                'recent_consultations' => Consultation::with('user:id,first_name,last_name')
                    ->orderBy('created_at', 'desc')
                    ->limit(5)
                    ->get()
            ];
        });
        
        return response()->json(['success' => true, 'data' => $stats]);
    }

    public function appointmentsToday()
    {
        $appointments = Appointment::with('user:id,student_id,first_name,last_name')
            ->whereDate('appointment_date', Carbon::today('Asia/Manila'))
            ->orderBy('time_slot')
            ->get();

        return response()->json(['success' => true, 'data' => $appointments]);
    }

    public function recentActivity()
    {
        $consultations = Consultation::with('user:id,first_name,last_name')
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();

        return response()->json(['success' => true, 'data' => $consultations]);
    }

    public function consultationReport(Request $request)
    {
        $total = Consultation::whereBetween('created_at', [
            $request->start_date, $request->end_date
        ])->count();

        return response()->json(['success' => true, 'data' => ['total' => $total]]);
    }

    public function appointmentReport(Request $request)
    {
        $total = Appointment::whereBetween('appointment_date', [
            $request->start_date, $request->end_date
        ])->count();

        return response()->json(['success' => true, 'data' => ['total' => $total]]);
    }

    public function dailySummary()
    {
        $today = Carbon::today('Asia/Manila');
        
        return response()->json([
            'success' => true,
            'data' => [
                'consultations' => Consultation::whereDate('created_at', $today)->count(),
                'appointments' => Appointment::whereDate('appointment_date', $today)->count(),
                'checked_in' => \App\Models\AppointmentCheckin::whereDate('checked_in_at', $today)->count(),
            ]
        ]);
    }
}