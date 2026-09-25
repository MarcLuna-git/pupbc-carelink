<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use App\Support\DatabaseSearch;
use App\Models\Appointment;
use App\Services\AppointmentEventNotification;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Carbon\Carbon;

class AppointmentController extends Controller
{
    public function index(Request $request)
    {
        $query = Appointment::with(['user:id,student_id,first_name,last_name', 'user.studentProfile'])
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->when($request->date, fn($q) => $q->whereDate('appointment_date', $request->date))
            ->when($request->search, function($q) use ($request) {
                $q->whereHas('user', fn($q) => 
                    $q->where('first_name', DatabaseSearch::like($q), "%{$request->search}%")
                      ->orWhere('last_name', DatabaseSearch::like($q), "%{$request->search}%")
                      ->orWhere('student_id', DatabaseSearch::like($q), "%{$request->search}%")
                );
            })
            ->orderBy('appointment_date', 'desc');

        return response()->json(['success' => true, 'data' => $query->paginate(20)]);
    }

    public function show($id)
    {
        $appointment = Appointment::with([
            'user.studentProfile', 'user.healthProfile', 'approvedBy:id,first_name,last_name'
        ])->findOrFail($id);

        return response()->json(['success' => true, 'data' => $appointment]);
    }

    public function approve($id)
    {
        return $this->decide($id, 'approved');
    }
    public function reject(Request $request, $id)
    {
        $request->validate(['reason' => 'required|string|max:500']);
        return $this->decide($id, 'rejected', $request->reason);
    }
    public function cancel(Request $request, $id)
    {
        $data = $request->validate(['reason' => 'required|string|max:500']);

        $result = DB::transaction(function () use ($id, $data) {
            \App\Services\ClinicQueue::lock();
            $appointment = Appointment::findOrFail($id);
            abort_unless(in_array($appointment->status, ['pending', 'rejected'], true), 422, 'Only pending or rejected appointments can be cancelled by a nurse.');
            abort_if($appointment->checkins()->exists(), 409, 'A checked-in appointment cannot be cancelled.');

            $appointment->update([
                'status' => 'cancelled',
                'cancellation_reason' => $data['reason'],
                'cancelled_by' => auth()->id(),
                'cancelled_at' => now(),
            ]);

            app(AppointmentEventNotification::class)->send($appointment);

            AuditLog::create([
                'user_id' => auth()->id(),
                'action' => 'appointment_cancelled',
                'description' => 'Cancelled appointment ' . $appointment->id,
                'ip_address' => request()->ip(),
            ]);

            return response()->json(['success' => true, 'message' => 'Appointment cancelled.']);
        }, 3);

        Cache::forget('nurse_dashboard_stats');
        return $result;
    }
    private function decide($id, $status, $reason = null)
    {
        $result = DB::transaction(function () use ($id, $status, $reason) {
            \App\Services\ClinicQueue::lock();
            $appointment = Appointment::findOrFail($id);
            abort_unless($appointment->status === 'pending', 422, 'Only pending appointments can be approved or rejected.');
            $appointment->update(['status' => $status, 'approved_by' => $status === 'approved' ? auth()->id() : null, 'approved_at' => $status === 'approved' ? now() : null, 'rejection_reason' => $reason]);
            app(AppointmentEventNotification::class)->send($appointment);
            return response()->json(['success' => true, 'message' => 'Appointment ' . $status, 'data' => $appointment]);
        }, 3);
        Cache::forget('nurse_dashboard_stats');
        return $result;
    }
    public function reschedule(Request $request, $id)
    {
        $data = $request->validate(['appointment_date' => 'required|date_format:Y-m-d|after_or_equal:' . today('Asia/Manila')->toDateString(), 'time_slot' => 'required|string|in:8:00 AM,8:30 AM,9:00 AM,9:30 AM,10:00 AM,10:30 AM,11:00 AM,11:30 AM,1:00 PM,1:30 PM,2:00 PM,2:30 PM,3:00 PM,3:30 PM,4:00 PM,4:30 PM']);
        return DB::transaction(function () use ($data, $id) {
            \App\Services\ClinicQueue::lock();
            $appointment = Appointment::findOrFail($id);
            abort_unless(in_array($appointment->status, ['pending', 'approved'], true), 422, 'This appointment cannot be rescheduled.');
            abort_if(\App\Models\AppointmentCheckin::where('appointment_id', $id)->exists(), 409, 'A checked-in visit cannot be rescheduled.');
            abort_if(\App\Models\AppointmentSlot::isSunday($data['appointment_date']), 422, 'The clinic is closed on Sundays.');
            abort_if(Carbon::parse($data['appointment_date'] . ' ' . $data['time_slot'], 'Asia/Manila')->isPast(), 422, 'Select a future appointment time.');
            $others = Appointment::where('id', '!=', $id)->whereDate('appointment_date', $data['appointment_date'])->whereIn('status', ['pending', 'approved']);
            abort_if((clone $others)->where('user_id', $appointment->user_id)->exists(), 422, 'Student already has an appointment that day.');
            abort_if((clone $others)->where('time_slot', $data['time_slot'])->count() >= 10, 422, 'Time slot is full.');
            $appointment->update($data);
            if ($appointment->wasChanged(['appointment_date', 'time_slot'])) {
                app(AppointmentEventNotification::class)->send($appointment, 'rescheduled');
            }
            Cache::forget('nurse_dashboard_stats');
            return response()->json(['success' => true, 'message' => 'Appointment rescheduled.', 'data' => $appointment]);
        }, 3);
    }
    public function complete($id)
    {
        $appointment = Appointment::findOrFail($id);
        abort_unless($appointment->status === 'completed' && \App\Models\Consultation::where('appointment_id', $id)->where('status', 'completed')->exists(), 422, 'Save the visit consultation to complete this appointment.');
        return response()->json(['success' => true, 'message' => 'Consultation already completed.']);
    }

    public function filterByStatus($status)
    {
        $appointments = Appointment::where('status', $status)
            ->with('user:id,student_id,first_name,last_name')->paginate(20);
        return response()->json(['success' => true, 'data' => $appointments]);
    }

    public function filterByDate($date)
    {
        $appointments = Appointment::whereDate('appointment_date', $date)
            ->with('user:id,student_id,first_name,last_name')->paginate(20);
        return response()->json(['success' => true, 'data' => $appointments]);
    }
}
