<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\AppointmentCheckin;
use App\Models\AppointmentSlot;
use App\Models\Notification;
use App\Models\QRCode;
use App\Models\User;
use App\Services\AppointmentExpiry;
use App\Services\ClinicQueue;
use App\Services\StudentAppointmentMail;
use App\Support\TimeGuard;
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

        if (AppointmentSlot::isClosed($date)) {
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
            // A no-show visit is over: it no longer blocks booking that date again.
            ->where(fn ($q) => $q->where('no_show', false)->orWhereNull('no_show'))
            ->exists();

        $closed = AppointmentSlot::isClosed($date);

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
                    'required|string|max:1000',
            ], ['concern.required' => 'Please give a short reason for this appointment.']);

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
            // A no-show visit is over: it no longer blocks booking that date again.
            ->where(fn ($q) => $q->where('no_show', false)->orWhereNull('no_show'))
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
            foreach (User::where('role', 'nurse')->get(['id']) as $nurse) {
                Notification::create([
                    'user_id' => $nurse->id,
                    'type' => 'appointment_booked',
                    'title' => 'New appointment booked',
                    'message' => $user->first_name . ' ' . $user->last_name . ' booked an appointment for '
                        . $appointment->appointment_date->format('M j, Y') . ' at ' . $appointment->time_slot . '.',
                    'data' => [
                        'appointment_id' => $appointment->id,
                        'reference_number' => $appointment->reference_number,
                        'appointment_date' => $appointment->appointment_date->toDateString(),
                        'time_slot' => $appointment->time_slot,
                        'status' => 'pending',
                    ],
                    'read' => false,
                ]);
            }
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

                // A request booked before a service was retired (e.g. Medical Clearance) may keep it.
                $currentService = Appointment::where('user_id', auth()->id())->whereKey($id)->value('service');
                $allowedServices = array_values(array_unique(array_filter([...self::SERVICES, $currentService])));

                $validated =
                    $request->validate([
                        'service' => [
                            'required',
                            'string',
                            \Illuminate\Validation\Rule::in($allowedServices),
                        ],

                        'appointment_date' =>
                            'required|date_format:Y-m-d',

                        'time_slot' =>
                            'required|string|in:' .
                            implode(
                                ',',
                                self::TIME_SLOTS
                            ),

                        'concern' =>
                            'required|string|max:1000',
                    ], ['concern.required' => 'Please give a short reason for this appointment.']);

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
            // A no-show visit is over: it no longer blocks booking that date again.
            ->where(fn ($q) => $q->where('no_show', false)->orWhereNull('no_show'))
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
        // The QR is issued at registration, but "Reset data" deletes it. Issue a
        // fresh one when it is missing so the student can still check in.
        $qrCode =
            QRCode::firstOrCreate(
                ['user_id' => $user->id],
                [
                    'qr_code_hash' => hash('sha256', $user->id . Str::random(32)),
                    'is_active' => true,
                ]
            );

        $appointment = Appointment::where('user_id', $user->id)
            ->whereDate(
                'appointment_date',
                Carbon::now(self::TIMEZONE)->toDateString()
            )
            // A completed visit stays on the QR page for the rest of the day so
            // the check-in tracker can show "Completed"; an open one comes first.
            ->whereIn('status', ['approved', 'completed'])
            ->with([
                'checkins' => fn ($query) => $this->selectStudentCheckinColumns($query),
            ])
            // A visit closed as No Show is over, so a new approved booking for the
            // same day comes before it (the kiosk checks in that one too:
            // KioskIdentity::appointment). The closed visit is still shown when
            // it is the only one today.
            // "IS NOT TRUE" covers false and NULL on both MySQL and PostgreSQL
            // (no_show is a real boolean there, so it cannot be compared with 0).
            ->orderByRaw("CASE WHEN status = 'approved' AND no_show IS NOT TRUE THEN 0 WHEN status = 'approved' THEN 1 ELSE 2 END")
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
                'recent_activity' => $this->qrRecentActivity($user->id),
                'live_queue' => $this->liveQueue($user->id),
            ],
        ]);
    }

    /*
     * Today's clinic queue for the student's QR page, in call order. Queue numbers only:
     * no names and no triage details of other students (same as the kiosk queue board).
     */
    private function liveQueue(string|int $userId): array
    {
        $rows = ClinicQueue::ordered()
            ->without(['user', 'triage', 'appointment'])
            ->whereIn('status', ['waiting', 'called', 'serving'])
            // The Developer tools demo patients stay on the nurse queue list only.
            ->when(\App\Support\DemoQueue::userIds(), fn ($query, $demoIds) => $query->whereNotIn('user_id', $demoIds))
            ->get(['id', 'user_id', 'queue_number', 'status']);

        $waiting = $rows->where('status', 'waiting')->values();
        $mine = $rows->firstWhere('user_id', $userId);
        $place = $mine ? $waiting->search(fn ($row) => $row->id === $mine->id) : false;

        return [
            'serving' => $rows->where('status', 'serving')->pluck('queue_number')->values(),
            'calling' => $rows->where('status', 'called')->pluck('queue_number')->values(),
            'waiting' => $waiting->take(8)->pluck('queue_number')->values(),
            'waiting_total' => $waiting->count(),
            'mine' => $mine ? [
                'queue_number' => $mine->queue_number,
                'status' => $mine->status,
                // How many waiting students are called before this one (null once called or serving).
                'ahead' => $place === false ? null : $place,
            ] : null,
        ];
    }

    private function qrRecentActivity(string|int $userId): array
    {
        $today = Carbon::now(self::TIMEZONE)->toDateString();

        return Appointment::where('user_id', $userId)
            ->with([
                'checkins' => fn ($query) => $this->selectStudentCheckinColumns($query),
            ])
            ->orderByRaw("CASE WHEN appointment_date = ? AND status = 'approved' AND no_show IS NOT TRUE THEN 0 ELSE 1 END", [$today])
            ->orderByDesc('created_at')
            ->orderByDesc('appointment_date')
            ->limit(5)
            ->get()
            ->map(function (Appointment $item) use ($today) {
                $checkin = $item->checkins->first();
                $date = $item->appointment_date?->toDateString();
                $noShow = (bool) $item->no_show;
                $queueStatus = $checkin?->status;
                $checkedInAt = $checkin?->checked_in_at ?? $checkin?->check_in_time;

                if ($item->status === 'completed' || $queueStatus === 'completed') {
                    $qrState = 'completed';
                    $qrNote = 'Checked in and consultation completed.';
                } elseif ($noShow || $queueStatus === 'no_show') {
                    $qrState = 'no_show';
                    $qrNote = 'Marked as no-show (missed check-in or call window).';
                } elseif ($checkin) {
                    $qrState = 'checked_in';
                    $qrNote = $checkin->queue_number
                        ? "Checked in at kiosk ({$checkin->queue_number})."
                        : 'Checked in at kiosk.';
                } elseif ($item->status === 'approved' && $date && $date < $today) {
                    $qrState = 'expired';
                    $qrNote = 'Expired (appointment date passed without check-in).';
                } elseif ($item->status === 'approved' && $date === $today) {
                    $qrState = 'active';
                    $qrNote = 'QR active for today\'s check-in.';
                } elseif ($item->status === 'approved') {
                    $qrState = 'upcoming';
                    $qrNote = 'QR will activate on your appointment day.';
                } elseif ($item->status === 'pending') {
                    $qrState = 'pending';
                    $qrNote = 'Waiting for nurse approval before QR activates.';
                } elseif ($item->status === 'cancelled') {
                    $qrState = 'cancelled';
                    $qrNote = 'Appointment cancelled; QR deactivated.';
                } else {
                    $qrState = 'rejected';
                    $qrNote = 'Appointment declined; QR not activated.';
                }

                return [
                    'id' => $item->id,
                    'reference_number' => $item->reference_number,
                    'service' => $item->service,
                    'appointment_date' => $date,
                    'time_slot' => $item->time_slot,
                    'qr_state' => $qrState,
                    'qr_note' => $qrNote,
                    'queue_number' => $checkin?->queue_number,
                    'checked_in_at' => $checkedInAt?->toIso8601String(),
                ];
            })
            ->values()
            ->all();
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

                // A called patient is already in the nurse's queue flow: cancelling
                // would leave a "called" check-in behind and block every later call.
                if (
                    (clone $checkins)
                        ->whereIn(
                            'status',
                            ['called', 'serving']
                        )
                        ->exists()
                ) {
                    return response()->json([
                        'success' => false,
                        'message' =>
                            'A called or ongoing consultation cannot be cancelled.',
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
                $student = auth()->user();
                foreach (User::where('role', 'nurse')->get(['id']) as $nurse) {
                    Notification::create([
                        'user_id' => $nurse->id,
                        'type' => 'appointment_cancelled_by_student',
                        'title' => 'Student cancelled an appointment',
                        'message' => $student->first_name . ' ' . $student->last_name . ' cancelled an appointment for '
                            . $appointment->appointment_date->format('M j, Y') . ' at ' . $appointment->time_slot . '.',
                        'data' => [
                            'appointment_id' => $appointment->id,
                            'reference_number' => $appointment->reference_number,
                            'appointment_date' => $appointment->appointment_date->toDateString(),
                            'time_slot' => $appointment->time_slot,
                            'status' => 'cancelled',
                        ],
                        'read' => false,
                    ]);
                }
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
            AppointmentSlot::isClosed(
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
        // Developer Tools → Remove time Guard: past dates are allowed.
        if (TimeGuard::bypassed()) {
            return;
        }

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
        // Developer Tools → Remove time Guard: past time slots are allowed.
        if (TimeGuard::bypassed()) {
            return;
        }

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

        // A no-show (approved but never attended) reads as Expired, like the nurse Appointments page.
        if ($appointment->status === 'approved' && $appointment->no_show) {
            $data['status'] = 'expired';
        }

        $expiry = app(AppointmentExpiry::class);
        $data['checkin_opens_at'] = $expiry->getCheckinOpening($appointment)->toIso8601String();
        $data['checkin_deadline_at'] = $expiry->getCheckinDeadline($appointment)->toIso8601String();

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
