<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\AuthController;

use App\Http\Controllers\Api\Student\ProfileController;
use App\Http\Controllers\Api\Student\HealthProfileController;
use App\Http\Controllers\Api\Student\AppointmentController as StudentAppointmentController;
use App\Http\Controllers\Api\Student\ConsultationController as StudentConsultationController;
use App\Http\Controllers\Api\Student\DashboardController as StudentDashboardController;
use App\Http\Controllers\Api\Student\NotificationController as StudentNotificationController;

use App\Http\Controllers\Api\Nurse\AppointmentController as NurseAppointmentController;
use App\Http\Controllers\Api\Nurse\ConsultationController as NurseConsultationController;
use App\Http\Controllers\Api\Nurse\StudentController as NurseStudentController;
use App\Http\Controllers\Api\Nurse\DashboardController as NurseDashboardController;
use App\Http\Controllers\Api\Nurse\AnnouncementController;
use App\Http\Controllers\Api\Nurse\MedicineController;
use App\Http\Controllers\Api\Nurse\EmergencyEncounterController;

use App\Http\Controllers\Api\Kiosk\CheckinController;
use App\Http\Controllers\Api\Kiosk\KioskController;


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


Route::get('/test', function () {
    return response()->json([
        'success' => true,
        'message' => 'PUPBC CareLink API is working!',
        'version' => '1.0.0',
        'timestamp' => now()->toDateTimeString(),
    ]);
});


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
    'throttle:60,1,authenticated:',
])
    ->group(function () {

        Route::prefix('auth')
            ->group(function () {

                Route::post(
                    '/logout',
                    [AuthController::class, 'logout']
                );

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
            ->group(function () {

                Route::get('/', function (Request $request) {
                    $notifications =
                        \App\Models\Notification::where(
                            'user_id',
                            auth()->id()
                        )
                            ->orderBy(
                                'created_at',
                                'desc'
                            )
                            ->paginate(20);

                    return response()->json([
                        'success' => true,
                        'data' => $notifications,
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
                | Student Notifications
                |--------------------------------------------------------------------------
                */

                Route::prefix('notifications')
                    ->group(function () {

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
            ->middleware('nurse')
            ->group(function () {

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

                Route::get(
                    '/queue/checkins',
                    [CheckinController::class, 'todayCheckins']
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

                Route::get('/academic-periods', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'periods']);
                Route::post('/academic-periods', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'storePeriod']);
                Route::put('/academic-periods/{id}', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'updatePeriod']);
                Route::get('/courses', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'courses']);
                Route::post('/courses', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'storeCourse']);
                Route::put('/courses/{id}', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'updateCourse']);
                Route::get('/course-sections', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'sections']);
                Route::post('/course-sections', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'storeSection']);
                Route::put('/course-sections/{id}', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'updateSection']);
                Route::post('/student-enrollments', [\App\Http\Controllers\Api\Nurse\CourseManagementController::class, 'enroll']);

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

                Route::get(
                    '/students/{id}',
                    [NurseStudentController::class, 'show']
                );


                /*
                |--------------------------------------------------------------------------
                | Nurse Consultations
                |--------------------------------------------------------------------------
                */

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
