<?php

namespace Tests\Feature;

use App\Models\PendingRegistration;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Registering with an email or Student ID that is already taken must end in a
 * plain message, never in a database error shown to the student.
 */
class RegistrationDuplicateTest extends TestCase
{
    use DatabaseTransactions;

    private function details(string $studentId, string $email): array
    {
        return [
            'student_id' => $studentId,
            'first_name' => 'Dup',
            'middle_name' => null,
            'last_name' => 'Tester',
            'email' => $email,
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'birthday' => '2000-01-01',
            'gender' => 'male',
            'course' => 'BSIT',
            'year' => '1st Year',
            'section' => '1-1',
            'mobile_number' => '+639171234567',
        ];
    }

    private function archivedStudent(string $studentId, string $email): User
    {
        $user = User::create([
            'student_id' => $studentId,
            'first_name' => 'Old',
            'last_name' => 'Account',
            'email' => $email,
            'password' => Hash::make('Password123!'),
            'role' => 'student',
            'birthday' => '2000-01-01',
            'status' => 'archived',
        ]);
        $user->delete();

        return $user;
    }

    public function test_an_archived_students_id_and_email_count_as_registered(): void
    {
        Mail::fake();
        $this->archivedStudent('2020-90001-BN-0', 'archived-dup@example.test');
        $service = app(AuthService::class);

        try {
            $service->requestRegistrationOtp($this->details('2020-90001-BN-0', 'new-dup@example.test'));
            $this->fail('The archived Student ID was accepted.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('student_id', $e->errors());
        }

        try {
            $service->requestRegistrationOtp($this->details('2020-90002-BN-0', 'archived-dup@example.test'));
            $this->fail('The archived email was accepted.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('email', $e->errors());
        }

        $this->assertSame(0, PendingRegistration::whereIn('student_id', ['2020-90001-BN-0', '2020-90002-BN-0'])->count());
    }

    public function test_verifying_a_code_for_a_taken_student_id_gives_a_plain_message(): void
    {
        $data = $this->details('2020-90003-BN-0', 'pending-dup@example.test');
        $data['password_hash'] = Hash::make($data['password']);
        unset($data['password'], $data['password_confirmation']);

        PendingRegistration::create([
            'email' => $data['email'],
            'student_id' => $data['student_id'],
            'payload' => $data,
            'otp_hash' => Hash::make('123456'),
            'expires_at' => now()->addMinutes(10),
        ]);
        // The account was archived after the code was sent.
        $this->archivedStudent('2020-90003-BN-0', 'someone-else@example.test');

        $response = $this->postJson('/api/auth/register/verify', ['email' => $data['email'], 'otp' => '123456']);

        $response->assertStatus(422)->assertJsonPath('errors.student_id.0', 'This Student ID is already registered.');
        $this->assertStringNotContainsString('SQLSTATE', $response->getContent());
    }

    public function test_a_second_identical_submission_does_not_show_a_database_error(): void
    {
        Mail::fake();
        $service = app(AuthService::class);
        $details = $this->details('2020-90004-BN-0', 'double-dup@example.test');

        $service->requestRegistrationOtp($details);
        $second = $service->requestRegistrationOtp($details);

        $this->assertStringContainsString('already pending', $second['message']);
        $this->assertSame(1, PendingRegistration::where('email', 'double-dup@example.test')->count());
    }
}
