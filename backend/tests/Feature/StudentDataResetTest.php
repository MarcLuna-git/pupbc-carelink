<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\AppointmentCheckin;
use App\Models\Consultation;
use App\Models\HealthProfile;
use App\Models\QRCode;
use App\Models\StudentProfile;
use App\Models\TriageAssessment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

/*
 * Isolated SQLite HTTP tests for Settings → General "Reset data".
 *
 * The endpoint clears what the student entered across the portal, but must
 * never touch the account or the clinic's own medical records.
 */
class StudentDataResetTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:' . base64_encode(str_repeat('t', 32))]);
        config(['database.default' => 'reset_testing', 'database.connections.reset_testing' => [
            'driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true,
        ]]);
        DB::purge('reset_testing');
        config(['cache.default' => 'array']);
        Mail::fake();
        $this->withoutMiddleware(\App\Http\Middleware\ExpireStaleAppointments::class);

        foreach ([
            '2024_01_01_000000_create_users_table.php',
            '2026_07_04_180904_create_student_profiles_table.php',
            '2026_07_04_180948_create_health_profiles_table.php',
            '2026_07_04_181046_create_appointments_table.php',
            '2026_07_05_104955_create_appointment_checkins_table.php',
            '2026_07_04_181119_create_consultations_table.php',
            '2026_09_07_000001_add_visit_triage_and_emergency_encounters.php',
            '2026_07_05_110023_create_qr_codes_table.php',
        ] as $file) {
            (require database_path('migrations/' . $file))->up();
        }

        require_once database_path('migrations/2026_10_09_000001_create_nurse_sync_tables.php');
        (new \CreateNurseSyncTables)->up();
    }

    private function user(string $role, array $attributes = []): User
    {
        return User::create(array_merge([
            'student_id' => strtoupper($role) . '-' . Str::random(10),
            'first_name' => ucfirst($role),
            'last_name' => 'Test',
            'email' => Str::uuid() . '@example.test',
            'password' => Hash::make('TestPassword123!'),
            'role' => $role,
            'status' => 'active',
        ], $attributes));
    }

    public function test_reset_requires_the_account_password(): void
    {
        $student = $this->user('student');
        $profile = StudentProfile::create(['user_id' => $student->id, 'mobile_number' => '09123456789']);

        $this->actingAs($student, 'api')
            ->postJson('/api/student/reset-data', ['password' => 'not-the-password'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('password');

        $this->actingAs($student, 'api')
            ->postJson('/api/student/reset-data', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('password');

        // Nothing may be touched when the password does not match.
        $this->assertSame('09123456789', $profile->fresh()->mobile_number);
    }

    public function test_reset_clears_student_input_and_keeps_the_account_and_clinic_records(): void
    {
        $student = $this->user('student', ['mobile_number' => '09987654321']);
        $nurse = $this->user('nurse');

        $profile = StudentProfile::create([
            'user_id' => $student->id,
            'course' => 'BSIT',
            'year' => '3',
            'section' => 'A',
            'mobile_number' => '09987654321',
            'address' => 'Old address',
            'guardian_name' => 'Guardian',
            'guardian_relationship' => 'Parent',
            'guardian_contact' => '09123456789',
            'profile_picture' => 'student-avatars/legacy.png',
        ]);

        HealthProfile::create([
            'user_id' => $student->id,
            'emergency_name' => 'Guardian',
            'emergency_relationship' => 'Parent',
            'emergency_phone' => '09123456789',
        ]);

        $appointment = Appointment::create([
            'user_id' => $student->id,
            'service' => 'Consultation',
            'appointment_date' => '2026-09-29',
            'time_slot' => '8:00 AM',
            'status' => 'approved',
        ]);

        $checkin = AppointmentCheckin::create([
            'appointment_id' => $appointment->id,
            'user_id' => $student->id,
            'checked_in_at' => now(),
        ]);

        TriageAssessment::create(['appointment_checkin_id' => $checkin->id]);

        // Visit claims have no foreign key, so the reset must clear them by hand.
        DB::table('nurse_visit_claims')->insert([
            'checkin_id' => $checkin->id,
            'session_hash' => Str::random(64),
            'expires_at' => now()->addHour(),
        ]);

        QRCode::create(['user_id' => $student->id, 'qr_code_hash' => Str::random(32)]);

        // Clinic-owned record: this one has to survive the reset.
        $consultation = Consultation::create([
            'user_id' => $student->id,
            'nurse_id' => $nurse->id,
            'appointment_id' => $appointment->id,
        ]);

        $revisionBefore = DB::table('nurse_sync_revisions')->where('topic', 'appointments')->value('revision');

        $this->actingAs($student, 'api')
            ->postJson('/api/student/reset-data', ['password' => 'TestPassword123!'])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.appointments', 1)
            ->assertJsonPath('data.qr_codes', 1)
            ->assertJsonPath('data.health_profile', true);

        // Appointments are hard deleted, taking their check-ins and triage.
        $this->assertSame(0, Appointment::withTrashed()->where('user_id', $student->id)->count());
        $this->assertDatabaseMissing('appointment_checkins', ['id' => $checkin->id]);
        $this->assertDatabaseMissing('triage_assessments', ['appointment_checkin_id' => $checkin->id]);
        $this->assertDatabaseMissing('nurse_visit_claims', ['checkin_id' => $checkin->id]);
        $this->assertDatabaseMissing('qr_codes', ['user_id' => $student->id]);

        // The health profile is gone, so onboarding starts over.
        $this->assertDatabaseMissing('health_profiles', ['user_id' => $student->id]);

        // Only what the student typed in is cleared on the profile row.
        $profile->refresh();
        $this->assertNull($profile->mobile_number);
        $this->assertNull($profile->address);
        $this->assertNull($profile->guardian_name);
        $this->assertNull($profile->guardian_relationship);
        $this->assertNull($profile->guardian_contact);
        $this->assertNull($profile->profile_picture);
        $this->assertSame('BSIT', $profile->course);
        $this->assertSame('3', $profile->year);
        $this->assertSame('A', $profile->section);

        // The account is untouched: same identity, only the contact cleared.
        $student->refresh();
        $this->assertSame('Student', $student->first_name);
        $this->assertSame('student', $student->role);
        $this->assertTrue(Hash::check('TestPassword123!', $student->password));
        $this->assertNull($student->mobile_number);

        // Clinic medical records stay, though the appointment link is nulled.
        $consultation->refresh();
        $this->assertNull($consultation->deleted_at);
        $this->assertNull($consultation->appointment_id);

        // Mass deletes bypass model events, so the nurse sync must be bumped.
        $this->assertGreaterThan(
            $revisionBefore,
            DB::table('nurse_sync_revisions')->where('topic', 'appointments')->value('revision')
        );
    }
}
