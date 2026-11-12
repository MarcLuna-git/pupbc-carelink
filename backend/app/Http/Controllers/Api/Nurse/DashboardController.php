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
    /*
     * Live counts for the sidebar badges of the Management pages:
     * appointment requests still waiting for an answer, patients in today's
     * queue (waiting or being called), and patients now in consultation.
     */
    public function navCounts()
    {
        $today = \App\Models\AppointmentCheckin::where('is_walk_in', false)
            ->where('created_at', '>=', today())
            ->where('created_at', '<', today()->addDay());

        return response()->json(['success' => true, 'data' => [
            'appointments' => Appointment::where('status', 'pending')->count(),
            'queue' => (clone $today)->whereIn('status', ['waiting', 'called'])->count(),
            'consultation' => (clone $today)->where('status', 'serving')->count(),
        ]])->header('Cache-Control', 'private, no-store');
    }

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

    /**
     * One clinic activity feed, newest first: bookings, approvals and
     * cancellations, kiosk check-ins, consultations and emergency encounters.
     * Each item: id, kind, title, detail, tone (success|warning|danger|info), occurred_at.
     */
    public function recentActivity()
    {
        $limit = 10;
        $name = fn ($user) => trim(($user->first_name ?? '') . ' ' . ($user->last_name ?? '')) ?: 'A student';
        $items = collect();

        Appointment::with('user:id,first_name,last_name')->latest()->limit($limit)->get()
            ->each(fn ($a) => $items->push([
                'id' => "booked-{$a->id}", 'kind' => 'appointment_booked', 'tone' => 'info',
                'title' => "{$name($a->user)} booked an appointment",
                'detail' => trim(($a->service ?? 'Clinic visit') . ' · ' . optional($a->appointment_date)->format('M j') . ' ' . ($a->time_slot ?? '')),
                'occurred_at' => $a->created_at,
            ]));

        Appointment::with('user:id,first_name,last_name')->whereNotNull('approved_at')->orderByDesc('approved_at')->limit($limit)->get()
            ->each(fn ($a) => $items->push([
                'id' => "approved-{$a->id}", 'kind' => 'appointment_approved', 'tone' => 'success',
                'title' => "Appointment approved for {$name($a->user)}",
                'detail' => trim(($a->service ?? 'Clinic visit') . ' · ' . optional($a->appointment_date)->format('M j') . ' ' . ($a->time_slot ?? '')),
                'occurred_at' => $a->approved_at,
            ]));

        Appointment::with('user:id,first_name,last_name')->whereNotNull('cancelled_at')->orderByDesc('cancelled_at')->limit($limit)->get()
            ->each(fn ($a) => $items->push([
                'id' => "cancelled-{$a->id}", 'kind' => 'appointment_cancelled', 'tone' => 'danger',
                'title' => "Appointment cancelled for {$name($a->user)}",
                'detail' => $a->cancellation_reason ?: ($a->service ?? 'Clinic visit'),
                'occurred_at' => $a->cancelled_at,
            ]));

        \App\Models\AppointmentCheckin::with('user:id,first_name,last_name')->whereNotNull('checked_in_at')->orderByDesc('checked_in_at')->limit($limit)->get()
            ->each(fn ($c) => $items->push([
                'id' => "checkin-{$c->id}", 'kind' => 'checked_in', 'tone' => 'info',
                'title' => "{$name($c->user)} checked in at the kiosk",
                'detail' => $c->queue_number ? "Queue number {$c->queue_number}" : null,
                'occurred_at' => $c->checked_in_at,
            ]));

        Consultation::with('user:id,first_name,last_name')->latest()->limit($limit)->get()
            ->each(fn ($c) => $items->push([
                'id' => "consultation-{$c->id}", 'kind' => 'consultation',
                'tone' => $c->status === 'completed' ? 'success' : ($c->status === 'cancelled' ? 'warning' : 'info'),
                'title' => "Consultation with {$name($c->user)}",
                'detail' => $c->chief_complaint,
                'occurred_at' => $c->created_at,
            ]));

        \App\Models\EmergencyEncounter::with('student:id,first_name,last_name')->latest()->limit($limit)->get()
            ->each(fn ($e) => $items->push([
                'id' => "emergency-{$e->id}", 'kind' => 'emergency', 'tone' => 'danger',
                'title' => "Emergency encounter for {$name($e->student)}",
                'detail' => $e->reason,
                'occurred_at' => $e->created_at,
            ]));

        $feed = $items->filter(fn ($item) => $item['occurred_at'])
            ->sortByDesc(fn ($item) => $item['occurred_at']->getTimestamp())
            ->take($limit)
            ->map(fn ($item) => array_merge($item, ['occurred_at' => $item['occurred_at']->toIso8601String()]))
            ->values();

        return response()->json(['success' => true, 'data' => $feed])->header('Cache-Control', 'private, no-store');
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
