<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\AuthController;

use App\Http\Controllers\Api\Student\ProfileController;
use App\Http\Controllers\Api\Student\DataResetController;
use App\Http\Controllers\Api\Student\HealthProfileController;
use App\Http\Controllers\Api\Student\AppointmentController as StudentAppointmentController;
use App\Http\Controllers\Api\Student\ConsultationController as StudentConsultationController;
use App\Http\Controllers\Api\Student\DashboardController as StudentDashboardController;
use App\Http\Controllers\Api\Student\NotificationController as StudentNotificationController;
use App\Http\Controllers\Api\Student\ChatbotController;
use App\Http\Controllers\Api\Student\DevToolsController;
use App\Http\Controllers\Api\Nurse\DevToolsController as NurseDevToolsController;

use App\Http\Controllers\Api\Nurse\AppointmentController as NurseAppointmentController;
use App\Http\Controllers\Api\Nurse\ConsultationController as NurseConsultationController;
use App\Http\Controllers\Api\Nurse\ConsultationDraftController;
use App\Http\Controllers\Api\Nurse\QueueSettingsController;
use App\Http\Controllers\Api\Nurse\StudentController as NurseStudentController;
use App\Http\Controllers\Api\Nurse\DashboardController as NurseDashboardController;
use App\Http\Controllers\Api\Nurse\AnnouncementController;
use App\Http\Controllers\Api\Nurse\CalendarNoteController;
use App\Http\Controllers\Api\Nurse\MedicineController;
use App\Http\Controllers\Api\Nurse\EmergencyEncounterController;

use App\Http\Controllers\Api\Kiosk\CheckinController;
use App\Http\Controllers\Api\Kiosk\KioskController;
use App\Http\Controllers\Api\Kiosk\DevToolsController as KioskDevToolsController;


Route::get('/health', function () {
    $database = 'down';
    $databaseError = null;

    try {
        \Illuminate\Support\Facades\DB::select('select 1');
        $database = 'connected';
    } catch (\Throwable $e) {
        $databaseError = 'Database unavailable.';
    }

    return response()->json([
        'success' => true,
        'status' => 'healthy',
        'version' => '1.0.0',
        'timestamp' => now()->toDateTimeString(),
        'environment' => app()->environment(),
        'database' => $database,
        'database_error' => $databaseError,
    ]);
});


// Uploaded student photos. Outside the throttle so a list of avatars cannot
// use up a viewer's API rate limit.
Route::get('/media/student-avatars/{path}', [ProfileController::class, 'avatar'])
    ->where('path', '[A-Za-z0-9._-]+')
    ->withoutMiddleware(['throttle:api', \App\Http\Middleware\ExpireStaleAppointments::class]);


Route::get('/test', function () {
    return response()->json([
        'success' => true,
        'message' => 'PUPBC CareLink API is working!',
        'version' => '1.0.0',
        'timestamp' => now()->toDateTimeString(),
    ]);
});


// Hidden /kiosk/dev demo mode password check (read-only, no DB writes).
Route::post('/kiosk/dev-verify', [KioskDevToolsController::class, 'verifyPassword'])
    ->middleware('throttle:10,1,kiosk-dev:');

// Separate group counters; all groups still share the outer throttle:api limit.
Route::prefix('kiosk')
    ->middleware([
        'kiosk.device',
        'throttle:120,1,kiosk:',
    ])
    ->group(function () {

        Route::post(
            '/lookup',
            [KioskController::class, 'lookup']
        );

        Route::post(
            '/checkin',
            [KioskController::class, 'checkin']
        );

        Route::get(
            '/queue',
            [KioskController::class, 'todayQueue']
        );
        Route::get('/session', function () { return response()->json(['success' => true]); });

        // Hidden /kiosk/settings page → Developer Tools.
        Route::get('/dev-tools', [KioskDevToolsController::class, 'show']);
        Route::put('/dev-tools', [KioskDevToolsController::class, 'update']);

        Route::post(
            '/verify-qr',
            [CheckinController::class, 'verifyQR']
        );

        Route::get(
            '/appointment/{reference}',
            [CheckinController::class, 'getAppointment']
        );

        Route::get(
            '/available-slots',
            [KioskController::class, 'availableSlots']
        );
    });

// Registration form options, kept out of the auth group's tight rate limit.
Route::get('/auth/registration-options', [AuthController::class, 'registrationOptions'])
    ->middleware('throttle:60,1,registration-options:');

// Live Student ID check on the registration form (masterlist). Tight limit so the list
// cannot be read by trying many IDs.
Route::post('/auth/check-student-id', [AuthController::class, 'checkStudentId'])
    ->middleware('throttle:20,1,student-id-check:');

Route::prefix('auth')
    ->middleware([
        'jwt.configured',
        'throttle:10,1,auth:',
    ])
    ->group(function () {

        Route::post(
            '/register',
            [AuthController::class, 'register']
        );

        Route::post(
            '/register/verify',
            [AuthController::class, 'verifyRegistration']
        );

        Route::post(
            '/register/resend-otp',
            [AuthController::class, 'resendRegistrationOtp']
        );

        Route::post(
            '/login',
            [AuthController::class, 'login']
        );

        Route::post(
            '/forgot-password',
            [AuthController::class, 'forgotPassword']
        );

        Route::post(
            '/verify-password-reset-otp',
            [AuthController::class, 'verifyPasswordResetOtp']
        );

        Route::post(
            '/reset-password',
            [AuthController::class, 'resetPassword']
        );

        Route::post(
            '/nurse-login',
            [AuthController::class, 'nurseLogin']
        );

        // Legacy admin-login alias ito; Nurse accounts lang ang puwede.
        Route::post(
            '/admin-login',
            [AuthController::class, 'nurseLogin']
        );
    });


// Sign-out works without a valid session too, so an expired session can still
// clear its httpOnly cookie (AuthController::logout).
Route::post('/auth/logout', [AuthController::class, 'logout'])
    ->middleware(['jwt.configured', 'throttle:30,1,logout:']);


Route::middleware('throttle:60,1,announcements:')
    ->group(function () {

        Route::get(
            '/announcements',
            [AnnouncementController::class, 'index']
        );

        Route::get(
            '/announcements/{id}',
            [AnnouncementController::class, 'show']
        );
    });


Route::middleware([
    'jwt.configured',
    'auth:api',
    'throttle:authenticated',
])
    ->group(function () {

        Route::prefix('auth')
            ->group(function () {

                Route::post(
                    '/refresh',
                    [AuthController::class, 'refresh']
                );

                Route::get(
                    '/me',
                    [AuthController::class, 'me']
                );

                Route::post(
                    '/change-password',
                    [AuthController::class, 'changePassword']
                );
            });


        /*
        |--------------------------------------------------------------------------
        | Existing Shared Notifications
        |--------------------------------------------------------------------------
        |
        | Keep this block for existing compatibility.
        | Student-specific notification endpoints are defined inside
        | the /student group below.
        |
        */

        Route::prefix('notifications')
            ->middleware(\App\Http\Middleware\NurseOperation::class)
            ->group(function () {

                Route::get('/', function (Request $request) {
                    $filters = $request->validate([
                        'category' => 'nullable|in:all,medicine,appointment,consultation',
                        'status' => 'nullable|in:all,unread',
                    ]);
                    $category = $filters['category'] ?? 'all';
                    $unreadOnly = ($filters['status'] ?? 'all') === 'unread';
                    $user = auth()->user();

                    /*
                    |--------------------------------------------------------------------------
                    | Free on-demand medicine expiry check
                    |--------------------------------------------------------------------------
                    |
                    | While the project is still in testing, this avoids needing a paid
                    | scheduler/cron service. Whenever a nurse loads the shared notifications
                    | endpoint, medicines expiring within the next three months are checked.
                    |
                    | Duplicate notifications are prevented per nurse + medicine.
                    |
                    */
                    if ($user && $user->role === 'nurse') {
                        $today = today('Asia/Manila');
                        $expiryLimit = $today->copy()->addMonths(3);

                        // Stocked batches count before the medicine's own date (first-expiry rule).
                        $expiringMedicines = \App\Models\Medicine::expiringSoon()
                            ->get(['id', 'name', 'expiry_date'])
                            ->map(function ($medicine) {
                                $medicine->nearest_expiry = $medicine->nearestExpiry();
                                return $medicine;
                            })
                            ->filter(fn ($medicine) => $medicine->nearest_expiry
                                && $medicine->nearest_expiry->greaterThanOrEqualTo($today->copy()->startOfDay())
                                && $medicine->nearest_expiry->lessThanOrEqualTo($expiryLimit->copy()->endOfDay()));

                        // Read existing alerts once instead of querying for every medicine.
                        // Include dismissed alerts so polling does not recreate them.
                        $notifiedMedicineIds = \App\Models\Notification::where('user_id', $user->id)
                            ->where('type', 'medicine_expiring_soon')
                            ->get(['data'])
                            ->map(function ($notification) { return $notification->data['medicine_id'] ?? null; })
                            ->filter()
                            ->flip();

                        foreach ($expiringMedicines as $medicine) {
                            if ($notifiedMedicineIds->has($medicine->id)) {
                                continue;
                            }

                            // The filter above excludes medicines without an expiry date.
                            /** @var \Illuminate\Support\Carbon $expiryDate */
                            $expiryDate = $medicine->nearest_expiry;

                            \App\Models\Notification::create([
                                'user_id' => $user->id,
                                'type' => 'medicine_expiring_soon',
                                'title' => 'Medicine Expiring Soon',
                                'message' => $medicine->name . ' expires on ' .
                                    $expiryDate->format('M j, Y') . '.',
                                'data' => [
                                    'medicine_id' => $medicine->id,
                                    'expiry_date' => $expiryDate->toDateString(),
                                ],
                            ]);
                        }

                        // "Expires today" and "Expired", once per medicine and expiry date.
                        \App\Services\MedicineExpiryAlerts::generateFor($user);
                    }

                    $notifications = \App\Models\Notification::where(
                        'user_id',
                        auth()->id()
                    )
                        ->when($category !== 'all', function ($query) use ($category) {
                            $query->where('type', 'like', $category . '\_%');
                        })
                        // The header dropdown's "Unread" tab.
                        ->when($unreadOnly, function ($query) {
                            $query->where('read', false);
                        })
                        ->where(function ($query) {
                            $query->whereNotIn('type', \App\Services\MedicineExpiryAlerts::KEPT_WHEN_DISMISSED)
                                ->orWhereNull('data->dismissed')
                                ->orWhere('data->dismissed', false);
                        })
                        ->orderBy('created_at', 'desc')
                        ->paginate(20);

                    return response()->json([
                        'success' => true,
                        'data' => $notifications,
                        'unread_count' => \App\Models\Notification::where(
                            'user_id',
                            auth()->id()
                        )->where('read', false)->count(),
                    ]);
                });

                Route::patch(
                    '/{id}/read',
                    function ($id) {
                        \App\Models\Notification::where(
                            'id',
                            $id
                        )
                            ->where(
                                'user_id',
                                auth()->id()
                            )
                            ->update([
                                'read' => true,
                                'read_at' => now(),
                            ]);

                        return response()->json([
                            'success' => true,
                            'message' => 'Marked as read',
                        ]);
                    }
                );

                Route::patch(
                    '/read-all',
                    function () {
                        \App\Models\Notification::where(
                            'user_id',
                            auth()->id()
                        )
                            ->update([
                                'read' => true,
                                'read_at' => now(),
                            ]);

                        return response()->json([
                            'success' => true,
                            'message' => 'All marked as read',
                        ]);
                    }
                );

                Route::delete(
                    '/{id}',
                    function ($id) {
                        $notification = \App\Models\Notification::where('id', $id)
                            ->where('user_id', auth()->id())
                            ->firstOrFail();
                        if (in_array($notification->type, \App\Services\MedicineExpiryAlerts::KEPT_WHEN_DISMISSED, true)) {
                            // Keep the row so both expiry generators retain their suppression record.
                            $notification->update([
                                'data' => array_merge($notification->data ?? [], ['dismissed' => true]),
                                'read' => true,
                                'read_at' => $notification->read_at ?? now(),
                            ]);
                        } else {
                            $notification->delete();
                        }

                        return response()->json([
                            'success' => true,
                            'message' => 'Notification deleted.',
                            'unread_count' => \App\Models\Notification::where(
                                'user_id',
                                auth()->id()
                            )->where('read', false)->count(),
                        ]);
                    }
                );
            });


        /*
        |--------------------------------------------------------------------------
        | Student Routes
        |--------------------------------------------------------------------------
        */

        Route::prefix('student')
            ->middleware('student')
            ->group(function () {

                /*
                |--------------------------------------------------------------------------
                | Clinic Assistant (AI chatbot)
                |--------------------------------------------------------------------------
                |
                | Dedicated throttle so one student cannot exhaust the shared
                | Gemini quota for everyone else.
                |
                */

                Route::post(
                    '/chatbot/message',
                    [ChatbotController::class, 'message']
                )->middleware([
                    'throttle:' . (int) config('chatbot.rate_limit', 5) . ',1',
                    'throttle:chatbot-daily',
                ]);

                /*
                |--------------------------------------------------------------------------
                | Student Notifications
                |--------------------------------------------------------------------------
                */

                Route::prefix('notifications')
                    ->group(function () {

                        Route::get('/unread-count', [StudentNotificationController::class, 'unreadCount']);

                        Route::get(
                            '/',
                            [
                                StudentNotificationController::class,
                                'index',
                            ]
                        );

                        Route::patch(
                            '/read-all',
                            [
                                StudentNotificationController::class,
                                'markAllAsRead',
                            ]
                        );

                        Route::patch(
                            '/{id}/read',
                            [
                                StudentNotificationController::class,
                                'markAsRead',
                            ]
                        );

                        Route::delete(
                            '/{id}',
                            [
                                StudentNotificationController::class,
                                'destroy',
                            ]
                        );
                    });


                /*
                |--------------------------------------------------------------------------
                | Student Clinic History
                |--------------------------------------------------------------------------
                */

                Route::get(
                    '/clinic-history',
                    function () {
                        return response()->json([
                            'success' => true,
                            'data' =>
                                app(
                                    \App\Services\ClinicHistory::class
                                )
                                    ->forStudent(
                                        auth()->id(),
                                        true
                                    ),
                        ]);
                    }
                );


                /*
                |--------------------------------------------------------------------------
                | Student Profile
                |--------------------------------------------------------------------------
                */

                Route::get(
                    '/profile',
                    [ProfileController::class, 'show']
                );

                Route::put(
                    '/profile',
                    [ProfileController::class, 'update']
                );

                Route::post(
                    '/profile/avatar',
                    [ProfileController::class, 'uploadAvatar']
                );

                Route::delete(
                    '/profile/avatar',
                    [ProfileController::class, 'removeAvatar']
                );

                Route::post('/profile/email/otp', [ProfileController::class, 'requestEmailOtp'])->middleware('throttle:5,10');
                Route::patch('/profile/email', [ProfileController::class, 'updateEmail']);


                /*
                |--------------------------------------------------------------------------
                | Student Data Reset
                |--------------------------------------------------------------------------
                |
                | Clears the data the student entered in the portal (appointments,
                | QR/queue trail, profile details, health profile) while leaving
                | the account and the clinic's medical records alone.
                |
                */

                Route::post(
                    '/reset-data',
                    [DataResetController::class, 'store']
                );


                /*
                |--------------------------------------------------------------------------
                | Student Health Profile
                |--------------------------------------------------------------------------
                */

                Route::get(
                    '/health-profile',
                    [HealthProfileController::class, 'show']
                );

                Route::post(
                    '/health-profile',
                    [HealthProfileController::class, 'store']
                );

                Route::put(
                    '/health-profile',
                    [HealthProfileController::class, 'update']
                );

                Route::get(
                    '/health-profile/status',
                    [HealthProfileController::class, 'checkStatus']
                );


                /*
                |--------------------------------------------------------------------------
                | Student Appointments
                |--------------------------------------------------------------------------
                */

                Route::get(
                    '/appointments',
                    [StudentAppointmentController::class, 'index']
                );

                Route::post(
                    '/appointments',
                    [StudentAppointmentController::class, 'store']
                );

                // Unahin ang specific route bago appointments/{id}.
                Route::get(
                    '/appointments/check-duplicate',
                    [
                        StudentAppointmentController::class,
                        'checkDuplicate',
                    ]
                );

                Route::get(
                    '/available-slots',
                    [
                        StudentAppointmentController::class,
                        'availableSlots',
                    ]
                );

                Route::put(
                    '/appointments/{id}',
                    [
                        StudentAppointmentController::class,
                        'update',
                    ]
                );

                Route::patch(
                    '/appointments/{id}/cancel',
                    [
                        StudentAppointmentController::class,
                        'cancel',
                    ]
                );

                Route::get(
                    '/appointments/{id}',
                    [
                        StudentAppointmentController::class,
                        'show',
                    ]
                );


                /*
                |--------------------------------------------------------------------------
                | Student Consultations / Health Records
                |--------------------------------------------------------------------------
                */

                Route::get(
                    '/consultations',
                    [StudentConsultationController::class, 'index']
                );

                Route::get(
                    '/consultations/latest',
                    [StudentConsultationController::class, 'latest']
                );

                Route::get(
                    '/consultations/{id}',
                    [StudentConsultationController::class, 'show']
                );


                /*
                |--------------------------------------------------------------------------
                | Student QR
                |--------------------------------------------------------------------------
                */

                Route::get(
                    '/qr',
                    [StudentAppointmentController::class, 'getQRCode']
                );

                Route::get(
                    '/qr/status',
                    [StudentAppointmentController::class, 'checkQRStatus']
                );


                /*
                |--------------------------------------------------------------------------
                | Student Developer Tools (Settings → Developer Tools)
                |--------------------------------------------------------------------------
                */

                Route::get(
                    '/dev-tools',
                    [DevToolsController::class, 'show']
                );

                Route::put(
                    '/dev-tools',
                    [DevToolsController::class, 'update']
                );


                /*
                |--------------------------------------------------------------------------
                | Legacy Student Dashboard APIs
                |--------------------------------------------------------------------------
                |
                | Dashboard UI is no longer part of active Student navigation,
                | but these APIs remain for compatibility.
                |
                */

                Route::get(
                    '/dashboard-stats',
                    [StudentDashboardController::class, 'stats']
                );

                Route::get(
                    '/upcoming-appointments',
                    [
                        StudentDashboardController::class,
                        'upcomingAppointments',
                    ]
                );

                Route::get(
                    '/recent-consultations',
                    [
                        StudentDashboardController::class,
                        'recentConsultations',
                    ]
                );
            });


        /*
        |--------------------------------------------------------------------------
        | Nurse Routes
        |--------------------------------------------------------------------------
        */

        Route::prefix('nurse')
            ->middleware(['nurse', \App\Http\Middleware\NurseOperation::class])
            ->group(function () {

                Route::get('/nav-counts', [NurseDashboardController::class, 'navCounts']);
                Route::get('/sync', function () {
                    return response()->json(['data' => \App\Services\NurseSync::revisions()])
                        ->header('Cache-Control', 'private, no-store');
                });
                Route::post('/queue/{id}/claim', [KioskController::class, 'claimVisit']);
                Route::delete('/queue/{id}/claim', [KioskController::class, 'releaseVisit']);

                Route::put(
                    '/profile',
                    [
                        \App\Http\Controllers\Api\Nurse\ProfileController::class,
                        'update',
                    ]
                );

                Route::post(
                    '/change-password',
                    [AuthController::class, 'changePassword']
                );


                Route::get(
                    '/clinic-history',
                    function () {
                        return response()->json([
                            'success' => true,
                            'data' =>
                                app(
                                    \App\Services\ClinicHistory::class
                                )
                                    ->forStudent(null),
                        ]);
                    }
                );


                /*
                |--------------------------------------------------------------------------
                | Nurse Dashboard
                |--------------------------------------------------------------------------
                */

                Route::get(
                    '/dashboard-stats',
                    [NurseDashboardController::class, 'stats']
                );

                Route::get(
                    '/dashboard/appointments-today',
                    [
                        NurseDashboardController::class,
                        'appointmentsToday',
                    ]
                );

                Route::get(
                    '/dashboard/recent-activity',
                    [
                        NurseDashboardController::class,
                        'recentActivity',
                    ]
                );


                /*
                |--------------------------------------------------------------------------
                | Nurse Queue
                |--------------------------------------------------------------------------
                */

                Route::get(
                    '/queue/today',
                    [KioskController::class, 'todayQueue']
                );

                Route::post(
                    '/queue/call-next',
                    [KioskController::class, 'callNext']
                );

                Route::post(
                    '/queue/{id}/arrived',
                    [KioskController::class, 'patientArrived']
                );

                Route::post(
                    '/queue/{id}/serve',
                    [KioskController::class, 'servePatient']
                );

                Route::post(
                    '/queue/{id}/recall',
                    [KioskController::class, 'recallPatient']
                );

                Route::post(
                    '/queue/{id}/hold',
                    [KioskController::class, 'holdPatient']
                );

                Route::post(
                    '/queue/{id}/no-show',
                    [KioskController::class, 'markNoShow']
                );

                Route::get(
                    '/queue/checkins',
                    [CheckinController::class, 'todayCheckins']
                );


                /*
                |--------------------------------------------------------------------------
                | Nurse Developer Tools (Settings → Developer Tools)
                |--------------------------------------------------------------------------
                */

                Route::get(
                    '/dev-tools',
                    [NurseDevToolsController::class, 'show']
                );

                Route::put(
                    '/dev-tools',
                    [NurseDevToolsController::class, 'update']
                );

                /*
                |--------------------------------------------------------------------------
                | Nurse Appointments
                |--------------------------------------------------------------------------
                */

                Route::get(
                    '/appointments',
                    [NurseAppointmentController::class, 'index']
                );

                // Unahin ang specific GET routes bago appointments/{id}.
                Route::get(
                    '/appointments/filter/{status}',
                    [
                        NurseAppointmentController::class,
                        'filterByStatus',
                    ]
                );

                Route::get(
                    '/appointments/date/{date}',
                    [
                        NurseAppointmentController::class,
                        'filterByDate',
                    ]
                );

                Route::patch(
                    '/appointments/{id}/approve',
                    [
                        NurseAppointmentController::class,
                        'approve',
                    ]
                );

                Route::patch(
                    '/appointments/{id}/reject',
                    [
                        NurseAppointmentController::class,
                        'reject',
                    ]
                );

                Route::patch(
                    '/appointments/{id}/cancel',
                    [
                        NurseAppointmentController::class,
                        'cancel',
                    ]
                );

                Route::patch(
                    '/appointments/{id}/reschedule',
                    [
                        NurseAppointmentController::class,
                        'reschedule',
                    ]
                );

                Route::patch(
                    '/appointments/{id}/complete',
                    [
                        NurseAppointmentController::class,
                        'complete',
                    ]
                );

                Route::get(
                    '/appointments/{id}',
                    [
                        NurseAppointmentController::class,
                        'show',
                    ]
                );


                /*
                |--------------------------------------------------------------------------
                | Nurse Student Directory
                |--------------------------------------------------------------------------
                */

                Route::get(
                    '/students',
                    [NurseStudentController::class, 'index']
                );

                Route::get(
                    '/students/search',
                    [NurseStudentController::class, 'search']
                );

                Route::get(
                    '/students/{id}/health-profile',
                    [
                        NurseStudentController::class,
                        'healthProfile',
                    ]
                );

                Route::patch('/students/{id}/medical-record', [NurseStudentController::class, 'updateMedicalRecord']);

                Route::patch('/students/{id}/archive', [NurseStudentController::class, 'archive']);
                Route::patch('/students/{id}/restore', [NurseStudentController::class, 'restore']);
                // Delete for good (admin password). Tight limit against password guessing.
                Route::delete('/students/{id}', [NurseStudentController::class, 'destroy'])
                    ->middleware('throttle:10,1,student-delete:');

                Route::get('/academic-periods', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'periods']);
                Route::post('/academic-periods', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'storePeriod']);
                Route::put('/academic-periods/{id}', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'updatePeriod']);
                Route::get('/courses', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'courses']);
                Route::post('/courses', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'storeCourse']);
                Route::put('/courses/{id}', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'updateCourse']);
                Route::get('/course-sections', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'sections']);
                Route::post('/course-sections', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'storeSection']);
                Route::put('/course-sections/{id}', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'updateSection']);
                Route::delete('/academic-periods/{id}', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'destroyPeriod']);
                Route::delete('/courses/{id}', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'destroyCourse']);
                Route::delete('/course-sections/{id}', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'destroySection']);
                Route::post('/student-enrollments', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'enroll']);

                // Course Management → Masterlist (school list of enrolled students).
                Route::get('/masterlist', [\App\Http\Controllers\Api\Nurse\MasterlistController::class, 'index']);
                Route::post('/masterlist/preview', [\App\Http\Controllers\Api\Nurse\MasterlistController::class, 'preview']);
                Route::post('/masterlist/import', [\App\Http\Controllers\Api\Nurse\MasterlistController::class, 'import']);
                Route::post('/masterlist/clear', [\App\Http\Controllers\Api\Nurse\MasterlistController::class, 'clear']);
                Route::put('/masterlist/{id}', [\App\Http\Controllers\Api\Nurse\MasterlistController::class, 'update'])->whereNumber('id');
                Route::delete('/masterlist/{id}', [\App\Http\Controllers\Api\Nurse\MasterlistController::class, 'destroy'])->whereNumber('id');

                Route::get(
                    '/students/{id}/appointments',
                    [
                        NurseStudentController::class,
                        'appointments',
                    ]
                );

                Route::get(
                    '/students/{id}/consultations',
                    [
                        NurseStudentController::class,
                        'consultations',
                    ]
                );

                Route::get(
                    '/students/{id}/emergency-encounters',
                    [
                        NurseStudentController::class,
                        'emergencyEncounters',
                    ]
                );

                Route::get(
                    '/students/{id}/clinic-history',
                    [
                        NurseStudentController::class,
                        'clinicHistory',
                    ]
                );

                // Extra record files (x-ray photos, lab results, documents) attached to a student.
                Route::get('/students/{id}/attachments', [\App\Http\Controllers\Api\Nurse\StudentAttachmentController::class, 'index']);
                Route::post('/students/{id}/attachments', [\App\Http\Controllers\Api\Nurse\StudentAttachmentController::class, 'store']);
                Route::get('/students/{id}/attachments/{attachmentId}/file', [\App\Http\Controllers\Api\Nurse\StudentAttachmentController::class, 'file']);
                Route::delete('/students/{id}/attachments/{attachmentId}', [\App\Http\Controllers\Api\Nurse\StudentAttachmentController::class, 'destroy']);

                Route::get(
                    '/students/{id}',
                    [NurseStudentController::class, 'show']
                );


                /*
                |--------------------------------------------------------------------------
                | Nurse Consultations
                |--------------------------------------------------------------------------
                */

                Route::get('/nurses', [NurseConsultationController::class, 'nurses']);

                // Consultation → visit → Save progress (server-side draft of one visit).
                Route::get('/consultation-drafts/{id}', [ConsultationDraftController::class, 'show']);
                Route::put('/consultation-drafts/{id}', [ConsultationDraftController::class, 'update']);
                Route::delete('/consultation-drafts/{id}', [ConsultationDraftController::class, 'destroy']);

                // Consultation → Queue list → Options: arrival time before a called student is skipped.
                Route::get('/queue-settings', [QueueSettingsController::class, 'show']);
                Route::put('/queue-settings', [QueueSettingsController::class, 'update']);

                // Queue list → Options → Developer tools: one looping demo patient.
                Route::get('/demo-queue', [\App\Http\Controllers\Api\Nurse\DemoQueueController::class, 'show']);
                Route::put('/demo-queue', [\App\Http\Controllers\Api\Nurse\DemoQueueController::class, 'update']);
                Route::post('/demo-queue/reset', [\App\Http\Controllers\Api\Nurse\DemoQueueController::class, 'reset']);

                Route::get(
                    '/consultations',
                    [NurseConsultationController::class, 'index']
                );

                Route::post(
                    '/consultations',
                    [NurseConsultationController::class, 'store']
                );

                Route::get(
                    '/consultations/today',
                    [
                        NurseConsultationController::class,
                        'todayConsultations',
                    ]
                );

                Route::get(
                    '/consultations/filter/{date}',
                    [
                        NurseConsultationController::class,
                        'filterByDate',
                    ]
                );

                Route::put(
                    '/consultations/{id}',
                    [NurseConsultationController::class, 'update']
                );

                Route::get(
                    '/consultations/{id}',
                    [NurseConsultationController::class, 'show']
                );


                /*
                |--------------------------------------------------------------------------
                | Emergency Encounters
                |--------------------------------------------------------------------------
                */

                Route::post(
                    '/emergency-encounters',
                    [
                        EmergencyEncounterController::class,
                        'store',
                    ]
                );


                /*
                |--------------------------------------------------------------------------
                | Medicines
                |--------------------------------------------------------------------------
                */

                Route::get(
                    '/medicines/stats',
                    [MedicineController::class, 'stats']
                );

                Route::get(
                    '/medicines/categories',
                    [MedicineController::class, 'categories']
                );

                Route::post(
                    '/medicines/{id}/add-stock',
                    [MedicineController::class, 'addStock']
                );

                Route::post(
                    '/medicines/{id}/reduce-stock',
                    [MedicineController::class, 'reduceStock']
                );

                Route::get(
                    '/medicines',
                    [MedicineController::class, 'index']
                );

                Route::post(
                    '/medicines',
                    [MedicineController::class, 'store']
                );

                Route::get(
                    '/medicines/{id}',
                    [MedicineController::class, 'show']
                );

                Route::get('/medicines/{id}/batches', [MedicineController::class, 'batches']);
                Route::get('/medicines/{id}/movements', [MedicineController::class, 'movements']);
                Route::post('/medicines/{id}/batches', [MedicineController::class, 'receiveBatch']);
                Route::post('/medicines/{id}/movements', [MedicineController::class, 'moveStock']);

                Route::put(
                    '/medicines/{id}',
                    [MedicineController::class, 'update']
                );

                Route::delete(
                    '/medicines/{id}',
                    [MedicineController::class, 'destroy']
                );


                /*
                |--------------------------------------------------------------------------
                | Faculty: directory and the medicines dispensed to faculty
                |--------------------------------------------------------------------------
                */
                /*
                |--------------------------------------------------------------------------
                | Documents: batch Medical Clearance certifications
                |--------------------------------------------------------------------------
                */
                Route::get('/medical-clearances', [\App\Http\Controllers\Api\Nurse\MedicalClearanceController::class, 'index']);
                Route::post('/medical-clearances', [\App\Http\Controllers\Api\Nurse\MedicalClearanceController::class, 'store']);
                Route::delete('/medical-clearances/{id}', [\App\Http\Controllers\Api\Nurse\MedicalClearanceController::class, 'destroy']);

                /*
                |--------------------------------------------------------------------------
                | Consultation → Batch Release: documents for a group of students (types in config/batch_documents.php)
                |--------------------------------------------------------------------------
                */
                Route::get('/batch-documents', [\App\Http\Controllers\Api\Nurse\BatchDocumentController::class, 'index']);
                Route::post('/batch-documents', [\App\Http\Controllers\Api\Nurse\BatchDocumentController::class, 'store']);
                Route::delete('/batch-documents/{id}', [\App\Http\Controllers\Api\Nurse\BatchDocumentController::class, 'destroy']);

                Route::get('/faculty', [\App\Http\Controllers\Api\Nurse\FacultyController::class, 'index']);
                Route::post('/faculty', [\App\Http\Controllers\Api\Nurse\FacultyController::class, 'store']);
                Route::get('/faculty/{id}', [\App\Http\Controllers\Api\Nurse\FacultyController::class, 'show']);
                Route::put('/faculty/{id}', [\App\Http\Controllers\Api\Nurse\FacultyController::class, 'update']);
                Route::delete('/faculty/{id}', [\App\Http\Controllers\Api\Nurse\FacultyController::class, 'destroy']);
                Route::post('/faculty/{id}/dispense', [\App\Http\Controllers\Api\Nurse\FacultyController::class, 'dispense']);
                Route::post('/faculty/{id}/consultations', [\App\Http\Controllers\Api\Nurse\FacultyController::class, 'consult']);
                Route::get('/faculty-dispensings', [\App\Http\Controllers\Api\Nurse\FacultyController::class, 'dispensings']);

                /*
                |--------------------------------------------------------------------------
                | Nurse Dashboard Calendar Notes
                |--------------------------------------------------------------------------
                */

                Route::patch('/duty-status', [\App\Http\Controllers\Api\Nurse\ProfileController::class, 'updateDutyStatus']);

                Route::get('/calendar-notes', [CalendarNoteController::class, 'index']);
                Route::post('/calendar-notes', [CalendarNoteController::class, 'store']);
                Route::put('/calendar-notes/{id}', [CalendarNoteController::class, 'update']);
                Route::delete('/calendar-notes/{id}', [CalendarNoteController::class, 'destroy']);


                /*
                |--------------------------------------------------------------------------
                | Nurse Announcements
                |--------------------------------------------------------------------------
                */

                Route::get(
                    '/announcements',
                    [AnnouncementController::class, 'index']
                );

                Route::post(
                    '/announcements',
                    [AnnouncementController::class, 'store']
                );

                Route::get(
                    '/announcements/{id}',
                    [AnnouncementController::class, 'show']
                );

                Route::put(
                    '/announcements/{id}',
                    [AnnouncementController::class, 'update']
                );

                Route::delete(
                    '/announcements/{id}',
                    [AnnouncementController::class, 'destroy']
                );


                /*
                |--------------------------------------------------------------------------
                | Reports
                |--------------------------------------------------------------------------
                */

                Route::get(
                    '/reports/consultations',
                    [
                        NurseDashboardController::class,
                        'consultationReport',
                    ]
                );

                Route::get(
                    '/reports/appointments',
                    [
                        NurseDashboardController::class,
                        'appointmentReport',
                    ]
                );

                Route::get(
                    '/reports/daily-summary',
                    [
                        NurseDashboardController::class,
                        'dailySummary',
                    ]
                );
            });
    });


Route::fallback(function () {
    return response()->json([
        'success' => false,
        'message' => 'API endpoint not found.',
    ], 404);
});
