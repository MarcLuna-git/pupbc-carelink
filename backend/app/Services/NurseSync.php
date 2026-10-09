<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class NurseSync
{
    public const TOPICS = [
        'Appointment' => 'appointments', 'AppointmentCheckin' => 'queue',
        'TriageAssessment' => 'queue', 'Consultation' => 'consultations',
        'EmergencyEncounter' => 'consultations', 'Medicine' => 'medicines',
        'MedicineBatch' => 'medicines', 'MedicineStockMovement' => 'medicines',
        'User' => 'students', 'StudentProfile' => 'students', 'HealthProfile' => 'students',
        'StudentEnrollment' => 'academic', 'Course' => 'academic',
        'CourseSection' => 'academic', 'AcademicPeriod' => 'academic',
        'Announcement' => 'announcements', 'Notification' => 'notifications',
    ];

    public static function changed(string $topic): void
    {
        DB::table('nurse_sync_revisions')->where('topic', $topic)->increment('revision');
    }

    public static function revisions(): array
    {
        $revisions = DB::table('nurse_sync_revisions')->pluck('revision', 'topic')->all();
        // Date-dependent queues, expiry indicators and summaries also change at midnight.
        $revisions['day'] = today('Asia/Manila')->toDateString();
        return $revisions;
    }
}
