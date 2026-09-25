<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\StudentProfile;
use App\Models\HealthProfile;
use App\Models\Appointment;
use App\Models\QrCode;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

/**
 * Creates / updates the default test accounts used for logging into the system.
 *
 *  - NURSE   : nurse@pupbc.edu.ph   / nurse         (Nurse Login page — email + password)
 *  - STUDENT : 2021-00001-BN-0      / student       (Student Login page — student ID + birthday + password)
 *
 * Idempotent: safe to run multiple times (`php artisan db:seed --force`).
 * Existing accounts are updated, not duplicated.
 *
 */
class CareLinkSeeder extends Seeder
{
    public function run()
    {
        // ============================================
        // 1. NURSE ACCOUNT (logs in via Nurse Login page)
        // ============================================
        $nurse = User::updateOrCreate(
            ['email' => 'nurse@pupbc.edu.ph'],
            [
                'first_name' => 'Jane',
                'last_name' => 'Doe',
                'password' => Hash::make(env('SEED_NURSE_PASSWORD') ?: 'nurse'),
                'role' => 'nurse',
                'status' => null,
                'email_verified_at' => now(),
            ]
        );

        $this->command->info('Nurse account ready: nurse@pupbc.edu.ph (password: SEED_NURSE_PASSWORD or "nurse")');

        // ============================================
        // 2. STUDENT ACCOUNT (logs in via Student Login page)
        // ============================================
        $user = User::updateOrCreate(
            ['student_id' => '2021-00001-BN-0'],
            [
                'first_name' => 'Juan',
                'last_name' => 'Dela Cruz',
                'email' => 'juan@example.com',
                'password' => Hash::make('student'),
                'role' => 'student',
                'status' => null,
                'birthday' => '2002-05-15',
                'email_verified_at' => now(),
            ]
        );

        // Student profile (course / year / section etc.)
        StudentProfile::updateOrCreate(
            ['user_id' => $user->id],
            [
                'course' => 'BSIT',
                'year' => '3',
                'section' => 'A',
                'birthday' => '2002-05-15',
                'gender' => 'male',
                'mobile_number' => '09123456789',
            ]
        );

        // Health profile — must be completed so login redirects to the dashboard
        HealthProfile::updateOrCreate(
            ['user_id' => $user->id],
            [
                'allergy_details' => 'None',
                'agree_privacy' => true,
                'agree_terms' => true,
                'completed_at' => now(),
            ]
        );

        // QR code used by the kiosk check-in system
        $qr = QrCode::updateOrCreate(
            ['user_id' => $user->id],
            [
                'qr_code_hash' => (string) Str::uuid(),
                'is_active' => true,
            ]
        );

        // Sample appointment — only created once (first run)
        if ($user->appointments()->count() === 0) {
            Appointment::create([
                'id' => (string) Str::uuid(),
                'user_id' => $user->id,
                'service' => 'General Checkup',
                'appointment_date' => Carbon::tomorrow(),
                'time_slot' => '9:00 AM - 10:00 AM',
                'concern' => 'Regular checkup',
                'status' => 'pending',
                'reference_number' => 'APT-' . strtoupper(Str::random(10)),
            ]);
        }

        $this->command->info('Student account ready: 2021-00001-BN-0 / birthday 2002-05-15 / student');
        $this->command->info('Seeding complete!');
    }
}