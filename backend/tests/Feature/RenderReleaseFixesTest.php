<?php

namespace Tests\Feature;

use App\Models\{Appointment, PendingRegistration, User};
use App\Services\AuthService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\{Cache, Hash, Mail};
use Illuminate\Support\Str;
use Tests\TestCase;

class RenderReleaseFixesTest extends TestCase
{
    use DatabaseTransactions;

    private function person($role = 'student')
    {
        return User::create(['student_id' => 'REL-' . Str::random(10), 'first_name' => 'Release', 'last_name' => 'Test', 'email' => Str::uuid() . '@example.test', 'password' => Hash::make('TestPassword123!'), 'birthday' => '2002-05-15', 'role' => $role, 'status' => null]);
    }

    private function pendingAppointment($student, $date)
    {
        return Appointment::create(['user_id' => $student->id, 'service' => 'General Checkup', 'appointment_date' => $date, 'time_slot' => '8:00 AM', 'status' => 'pending']);
    }

    public function test_first_api_request_of_the_day_expires_stale_pending_appointments_once()
    {
        Mail::fake();
        Cache::flush();
        $student = $this->person();
        $stale = $this->pendingAppointment($student, today('Asia/Manila')->subDays(2)->toDateString());
        $upcoming = $this->pendingAppointment($student, today('Asia/Manila')->addDay()->toDateString());

        $this->getJson('/api/health')->assertOk();

        $this->assertSame('expired', $stale->fresh()->status);
        $this->assertSame('pending', $upcoming->fresh()->status);

        // Runs once per day: a stale row created afterwards waits for tomorrow.
        $later = $this->pendingAppointment($student, today('Asia/Manila')->subDay()->toDateString());
        $this->getJson('/api/health')->assertOk();
        $this->assertSame('pending', $later->fresh()->status);
    }

    public function test_expired_pending_registration_can_be_resubmitted_with_corrected_details()
    {
        Mail::fake();
        $data = ['student_id' => 'NEW-' . Str::random(10), 'first_name' => 'Typo', 'last_name' => 'Registration', 'email' => Str::uuid() . '@example.test', 'password' => 'SecurePassword123!', 'birthday' => '2002-05-15'];
        $auth = app(AuthService::class);
        $auth->requestRegistrationOtp($data);

        // Still valid: the original pending registration is kept.
        $auth->requestRegistrationOtp(array_merge($data, ['first_name' => 'Fixed']));
        $this->assertSame('Typo', PendingRegistration::where('email', $data['email'])->firstOrFail()->payload['first_name']);

        // Expired: corrected details replace it.
        PendingRegistration::where('email', $data['email'])->update(['expires_at' => now()->subMinute()]);
        $auth->requestRegistrationOtp(array_merge($data, ['first_name' => 'Fixed']));
        $pending = PendingRegistration::where('email', $data['email'])->get();
        $this->assertCount(1, $pending);
        $this->assertSame('Fixed', $pending[0]->payload['first_name']);
    }

    public function test_nurse_can_open_archived_student_health_profile_and_clinic_history()
    {
        Mail::fake();
        $student = $this->person();
        $nurse = $this->person('nurse');
        $this->actingAs($nurse, 'api')->patchJson('/api/nurse/students/' . $student->id . '/archive', ['reason' => 'No longer enrolled'])->assertOk();

        $this->actingAs($nurse, 'api')->getJson('/api/nurse/students/' . $student->id)->assertOk();
        $this->actingAs($nurse, 'api')->getJson('/api/nurse/students/' . $student->id . '/health-profile')->assertOk();
        $this->actingAs($nurse, 'api')->getJson('/api/nurse/students/' . $student->id . '/clinic-history')->assertOk();
    }

    public function test_calendar_dates_serialize_as_plain_dates_not_utc_datetimes()
    {
        // A Manila-midnight date must not become the previous day in UTC ("2002-05-14T16:00:00Z").
        $this->assertSame('2002-05-15', $this->person()->toArray()['birthday']);
    }

    public function test_malformed_uuid_returns_validation_error_not_server_error()
    {
        $nurse = $this->person('nurse');
        $this->actingAs($nurse, 'api')->postJson('/api/nurse/student-enrollments', ['user_id' => 'not-a-uuid', 'course_section_id' => 'also-bad'])
            ->assertStatus(422)->assertJsonValidationErrors(['user_id', 'course_section_id']);
    }
}
