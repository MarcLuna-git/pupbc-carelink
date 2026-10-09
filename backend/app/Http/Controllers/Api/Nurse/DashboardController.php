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
        $revisions = \App\Services\NurseSync::revisions();
        $cacheKey = 'nurse_dashboard_counts:' . hash('sha256', json_encode(array_intersect_key($revisions,
            array_flip(['appointments', 'consultations', 'students', 'day']))));
        $stats = Cache::remember($cacheKey, 300, function() {
            $today = Carbon::today('Asia/Manila');
            $appointments = Appointment::selectRaw(
                "COUNT(CASE WHEN appointment_date = ? THEN 1 END) AS today_count,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count,
                COUNT(CASE WHEN appointment_date = ? AND status = 'approved' THEN 1 END) AS confirmed_count",
                [$today->toDateString(), $today->toDateString()])->first();
            $consultations = Consultation::selectRaw(
                "COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_count,
                COUNT(CASE WHEN created_at >= ? AND created_at < ? THEN 1 END) AS today_count",
                [$today, $today->copy()->addDay()])->first();
            return [
                'today_appointments' => (int) $appointments->today_count,
                'pending_appointments' => (int) $appointments->pending_count,
                'pending_approvals' => (int) $appointments->pending_count,
                'confirmed_appointments' => (int) $appointments->confirmed_count,
                'completed_consultations' => (int) $consultations->completed_count,
                'today_consultations' => (int) $consultations->today_count,
                'total_students' => User::where('role', 'student')->count(),
            ];
        });
        // Cache only aggregates; clinical rows stay fresh and out of the shared file cache.
        $today = Carbon::today('Asia/Manila')->toDateString();
        $stats['upcoming_appointments'] = Appointment::with('user:id,student_id,first_name,last_name')
                    ->where('status', 'approved')
                    ->where('appointment_date', '>=', $today)
                    ->orderBy('appointment_date')
                    ->limit(5)
                    ->get();
        $stats['recent_consultations'] = Consultation::with('user:id,first_name,last_name')
                    ->orderBy('created_at', 'desc')
                    ->limit(5)
                    ->get();
        $stats['today_schedule'] = Appointment::with('user:id,student_id,first_name,last_name')
            ->where('appointment_date', $today)->orderBy('time_slot')->limit(5)->get();
        
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
