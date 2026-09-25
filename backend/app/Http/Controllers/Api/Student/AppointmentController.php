<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\AppointmentCheckin;
use App\Models\AppointmentSlot;
use App\Models\Notification;
use App\Models\QRCode;
use App\Services\ClinicQueue;
use App\Services\StudentAppointmentMail;
use Carbon\Carbon;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AppointmentController extends Controller
{
    private const TIMEZONE = 'Asia/Manila';

    private const SERVICES = [
        'Consultation',
        'Medical Certificate',
        'Medical Clearance',
        'Follow-up Checkup',
        'Vaccination',
        'Other',
    ];

    private const TIME_SLOTS = [
        '8:00 AM',
        '8:30 AM',
        '9:00 AM',
        '9:30 AM',
        '10:00 AM',
        '10:30 AM',
        '11:00 AM',
        '11:30 AM',
        '1:00 PM',
        '1:30 PM',
        '2:00 PM',
        '2:30 PM',
        '3:00 PM',
        '3:30 PM',
        '4:00 PM',
        '4:30 PM',
    ];

    public function index()
    {
        $appointments = Appointment::where('user_id', auth()->id())
            ->with([
                'checkins' => fn ($query) => $this->selectStudentCheckinColumns($query),
            ])
            ->orderBy('appointment_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $appointments
                ->map(
                    fn (Appointment $appointment) =>
                        $this->appointmentData($appointment)
                )
                ->values(),
        ]);
    }

    public function availableSlots(Request $request)
    {
        $validated = $request->validate([
            'date' => 'required|date_format:Y-m-d',
        ]);

        $date = $validated['date'];

        $this->ensureDateNotPast($date);

        if (AppointmentSlot::isSunday($date)) {
            return response()->json([
                'success' => true,
                'message' => 'The clinic is closed on Sundays.',
                'data' => [
                    'date' => $date,
                    'closed' => true,
                    'slots' => [],
                ],
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'date' => $date,
                'closed' => false,
                'slots' => AppointmentSlot::getAvailableSlots($date),
            ],
        ]);
    }

    public function checkDuplicate(Request $request)
    {
        $validated = $request->validate([
            'date' => 'required|date_format:Y-m-d',
        ]);

        $date = $validated['date'];

        $this->ensureDateNotPast($date);

        $existing = Appointment::where('user_id', auth()->id())
            ->whereDate('appointment_date', $date)
            ->whereIn('status', [
                'pending',
                'approved',
            ])
            ->exists();

        $closed = AppointmentSlot::isSunday($date);

        return response()->json([
            'success' => true,
            'has_existing' => $existing,
            'closed' => $closed,
            'message' => $closed
                ? 'The clinic is closed on Sundays.'
                : (
                    $existing
                        ? 'You already have an appointment on this date.'
                        : null
                ),
        ]);
    }

    public function store(Request $request)
    {
        return DB::transaction(function () use ($request) {
            ClinicQueue::lock();

            $user = auth()->user();

            if (
                !$user ||
                in_array($user->status, ['inactive', 'archived'], true) ||
                !$user->healthProfile ||
                !$user->healthProfile->isComplete()
            ) {
                return response()->json([
                    'success' => false,
                    'message' => $user && in_array($user->status, ['inactive', 'archived'], true)
                        ? 'Your account is not eligible to book appointments.'
                        : 'Complete your health profile before booking.',
                ], 422);
            }

            $validated = $request->validate([
                'service' =>
                    'required|string|in:' .
                    implode(',', self::SERVICES),

                'appointment_date' =>
                    'required|date_format:Y-m-d',

                'time_slot' =>
                    'required|string|in:' .
                    implode(',', self::TIME_SLOTS),

                'concern' =>
                    'nullable|string|max:1000',
            ]);

            $date = $validated['appointment_date'];
            $time = $validated['time_slot'];

            $this->ensureClinicDay($date);
            $this->ensureFutureSlot(
                $date,
                $time
            );

            $existingOnDate =
                Appointment::where(
                    'user_id',
                    $user->id
                )
                    ->whereDate(
                        'appointment_date',
                        $date
                    )
                    ->whereIn(
                        'status',
                        [
                            'pending',
                            'approved',
                        ]
                    )
                    ->exists();

            if ($existingOnDate) {
                return response()->json([
                    'success' => false,
                    'message' =>
                        'You already have an appointment on this date. Please choose a different date.',
                ], 422);
            }

            if (
                !AppointmentSlot::isSlotAvailable(
                    $date,
                    $time
                )
            ) {
                return response()->json([
                    'success' => false,
                    'message' =>
                        'This time slot is already full or unavailable. Please select a different time.',
                ], 422);
            }

            $appointment =
                Appointment::create([
                    'user_id' =>
                        $user->id,

                    'service' =>
                        $validated['service'],

                    'appointment_date' =>
                        $date,

                    'time_slot' =>
                        $time,

                    'concern' =>
                        $validated[
                            'concern'
                        ] ?? null,

                    'status' =>
                        'pending',

                    'reference_number' =>
                        'APT-' .
                        strtoupper(
                            Str::random(8)
                        ),
                ]);

            Notification::create([
                'user_id' => $appointment->user_id,
                'type' => 'appointment_pending',
                'title' => 'Appointment request received',
                'message' => 'Your appointment request for '
                    . $appointment->appointment_date->format('M j, Y')
                    . ' at ' . $appointment->time_slot
                    . ' is pending clinic approval.',
                'data' => [
                    'appointment_id' => $appointment->id,
                    'reference_number' => $appointment->reference_number,
                    'appointment_date' => $appointment->appointment_date->toDateString(),
                    'time_slot' => $appointment->time_slot,
                    'status' => 'pending',
                ],
                'read' => false,
            ]);
            app(StudentAppointmentMail::class)->afterCommit($appointment);

            Cache::forget(
                'nurse_dashboard_stats'
            );

            return response()->json([
                'success' => true,
                'message' =>
                    'Appointment booked successfully!',
                'data' =>
                    $this->appointmentData(
                        $appointment
                    ),
            ], 201);
        }, 3);
    }

    public function update(
        Request $request,
        $id
    ) {
        return DB::transaction(
            function () use (
                $request,
                $id
            ) {
                ClinicQueue::lock();

                $validated =
                    $request->validate([
                        'service' =>
                            'required|string|in:' .
                            implode(
                                ',',
                                self::SERVICES
                            ),

                        'appointment_date' =>
                            'required|date_format:Y-m-d',

                        'time_slot' =>
                            'required|string|in:' .
                            implode(
                                ',',
                                self::TIME_SLOTS
                            ),

                        'concern' =>
                            'nullable|string|max:1000',
                    ]);

                $appointment =
                    Appointment::where(
                        'user_id',
                        auth()->id()
                    )
                        ->findOrFail(
                            $id
                        );

                if (
                    $appointment->status !==
                    'pending'
                ) {
                    return response()->json([
                        'success' => false,
                        'message' =>
                            'Only pending appointments can be edited.',
                    ], 422);
                }

                $date =
                    $validated[
                        'appointment_date'
                    ];

                $time =
                    $validated[
                        'time_slot'
                    ];

                $this->ensureClinicDay(
                    $date
                );

                $this->ensureFutureSlot(
                    $date,
                    $time
                );

                $existingOnDate =
                    Appointment::where(
                        'user_id',
                        auth()->id()
                    )
                        ->whereDate(
                            'appointment_date',
                            $date
                        )
                        ->whereIn(
                            'status',
                            [
                                'pending',
                                'approved',
                            ]
                        )
                        ->where(
                            'id',
                            '!=',
                            $appointment->id
                        )
                        ->exists();

                if ($existingOnDate) {
                    return response()->json([
                        'success' => false,
                        'message' =>
                            'You already have another appointment on this date.',
                    ], 422);
                }

                if (
                    !AppointmentSlot::isSlotAvailable(
                        $date,
                        $time,
                        $appointment->id
                    )
                ) {
                    return response()->json([
                        'success' => false,
                        'message' =>
                            'This time slot is unavailable. Please select a different time.',
                    ], 422);
                }

                $appointment->update([
                    'service' =>
                        $validated['service'],

                    'appointment_date' =>
                        $date,

                    'time_slot' =>
                        $time,

                    'concern' =>
                        $validated[
                            'concern'
                        ] ?? null,
                ]);

                Cache::forget(
                    'nurse_dashboard_stats'
                );

                $appointment->load([
                    'checkins' => fn ($query) => $this->selectStudentCheckinColumns($query),
                ]);

                return response()->json([
                    'success' => true,
                    'message' =>
                        'Appointment updated successfully.',
                    'data' =>
                        $this->appointmentData(
                            $appointment
                        ),
                ]);
            },
            3
        );
    }

    public function show($id)
    {
        $appointment =
            Appointment::where(
                'user_id',
                auth()->id()
            )
                ->with([
                    'checkins' => fn ($query) => $this->selectStudentCheckinColumns($query),
                ])
                ->findOrFail(
                    $id
                );

        return response()->json([
            'success' => true,
            'data' =>
                $this->appointmentData(
                    $appointment
                ),
        ]);
    }

    public function getQRCode()
    {
        $user = auth()->user();
        $qrCode =
            QRCode::where(
                'user_id',
                $user->id
            )->first();

        $appointment = Appointment::where('user_id', $user->id)
            ->whereDate(
                'appointment_date',
                Carbon::now(self::TIMEZONE)->toDateString()
            )
            ->where('status', 'approved')
            ->with([
                'checkins' => fn ($query) => $this->selectStudentCheckinColumns($query),
            ])
            ->orderBy('created_at')
            ->first();

        $available =
            $user->healthProfile &&
            $user->healthProfile->isComplete() &&
            $qrCode &&
            $qrCode->isUsable() &&
            $appointment;

        return response()->json([
            'success' => true,
            'data' => [
                'available' => (bool) $available,
                'qr_code_hash' => $available
                    ? $qrCode->qr_code_hash
                    : null,
                'appointment' => $appointment
                    ? $this->appointmentData($appointment)
                    : null,
            ],
        ]);
    }

    public function checkQRStatus()
    {
        $qrCode =
            QRCode::where(
                'user_id',
                auth()->id()
            )->first();

        return response()->json([
            'success' => true,
            'data' => [
                'exists' =>
                    $qrCode !== null,

                'active' =>
                    (bool) (
                        $qrCode
                            ? $qrCode->isUsable()
                            : false
                    ),
            ],
        ]);
    }

    public function cancel($id)
    {
        return DB::transaction(
            function () use ($id) {
                ClinicQueue::lock();

                $appointment =
                    Appointment::where(
                        'user_id',
                        auth()->id()
                    )
                        ->findOrFail(
                            $id
                        );

                if (
                    !in_array(
                        $appointment->status,
                        [
                            'pending',
                            'approved',
                        ],
                        true
                    )
                ) {
                    return response()->json([
                        'success' => false,
                        'message' =>
                            'Only pending or approved appointments can be cancelled.',
                    ], 422);
                }

                $checkins =
                    AppointmentCheckin::where(
                        'appointment_id',
                        $appointment->id
                    );

                if (
                    (clone $checkins)
                        ->where(
                            'status',
                            'serving'
                        )
                        ->exists()
                ) {
                    return response()->json([
                        'success' => false,
                        'message' =>
                            'An ongoing consultation cannot be cancelled.',
                    ], 409);
                }

                $checkins
                    ->where(
                        'status',
                        'waiting'
                    )
                    ->update([
                        'status' =>
                            'no_show',
                    ]);

                $appointment->update([
                    'status' =>
                        'cancelled',
                ]);

                // Notify the student only after a valid cancellation.
                // This notification is saved in the same transaction.
                Notification::create([
                    'user_id' => $appointment->user_id,
                    'type' => 'appointment_cancelled',
                    'title' => 'Appointment cancelled',
                    'message' => 'Your ' . $appointment->service
                        . ' appointment on '
                        . $appointment->appointment_date->format('M j, Y')
                        . ' has been cancelled.',
                    'data' => [
                        'appointment_id' => $appointment->id,
                        'reference_number' => $appointment->reference_number,
                        'appointment_date' => $appointment->appointment_date->toDateString(),
                        'time_slot' => $appointment->time_slot,
                        'status' => 'cancelled',
                    ],
                    'read' => false,
                ]);
                app(StudentAppointmentMail::class)->afterCommit($appointment);

                Cache::forget(
                    'nurse_dashboard_stats'
                );

                $appointment->load([
                    'checkins' => fn ($query) => $this->selectStudentCheckinColumns($query),
                ]);

                return response()->json([
                    'success' => true,
                    'message' =>
                        'Appointment cancelled.',
                    'data' =>
                        $this->appointmentData(
                            $appointment
                        ),
                ]);
            },
            3
        );
    }

    private function ensureClinicDay(
        string $date
    ): void {
        $this->ensureDateNotPast(
            $date
        );

        if (
            AppointmentSlot::isSunday(
                $date
            )
        ) {
            throw new HttpResponseException(
                response()->json([
                    'success' => false,
                    'message' =>
                        'The clinic is closed on Sundays. Please choose Monday to Saturday.',
                ], 422)
            );
        }
    }

    private function ensureDateNotPast(
        string $date
    ): void {
        $appointmentDate =
            Carbon::createFromFormat(
                'Y-m-d',
                $date,
                self::TIMEZONE
            )->startOfDay();

        $today =
            Carbon::now(
                self::TIMEZONE
            )->startOfDay();

        if (
            $appointmentDate->lessThan(
                $today
            )
        ) {
            throw new HttpResponseException(
                response()->json([
                    'success' => false,
                    'message' =>
                        'Please choose today or a future appointment date.',
                ], 422)
            );
        }
    }

    private function ensureFutureSlot(
        string $date,
        string $time
    ): void {
        $slot =
            Carbon::createFromFormat(
                'Y-m-d g:i A',
                $date .
                ' ' .
                $time,
                self::TIMEZONE
            );

        if (
            $slot->lessThanOrEqualTo(
                Carbon::now(
                    self::TIMEZONE
                )
            )
        ) {
            throw new HttpResponseException(
                response()->json([
                    'success' => false,
                    'message' =>
                        'Please choose a future appointment time.',
                ], 422)
            );
        }
    }

    private function appointmentData(
        Appointment $appointment
    ): array {
        if (
            !$appointment->relationLoaded(
                'checkins'
            )
        ) {
            $appointment->load([
                'checkins' => fn ($query) => $this->selectStudentCheckinColumns($query),
            ]);
        }

        $checkin =
            $appointment->checkins->first();

        $data =
            $appointment->toArray();

        unset(
            $data['checkins']
        );

        $checkedInAt = null;

        if ($checkin) {
            $checkedInAt =
                $checkin->checked_in_at
                ?: $checkin->check_in_time;
        }

        $data['queue'] =
            $checkin
                ? [
                    'queue_number' =>
                        $checkin->queue_number,

                    'queue_type' =>
                        $checkin->queue_type,

                    'status' =>
                        $checkin->status,

                    'checked_in_at' =>
                        $checkedInAt
                            ? $checkedInAt
                                ->toIso8601String()
                            : null,
                ]
                : null;

        return $data;
    }

    private function selectStudentCheckinColumns($query)
    {
        return $query
            ->select([
                'appointment_checkins.id',
                'appointment_checkins.appointment_id',
                'appointment_checkins.queue_number',
                'appointment_checkins.queue_type',
                'appointment_checkins.status',
                'appointment_checkins.checked_in_at',
                'appointment_checkins.check_in_time',
                'appointment_checkins.created_at',
            ])
            ->orderByDesc('appointment_checkins.created_at')
            ->orderByDesc('appointment_checkins.id');
    }
}
