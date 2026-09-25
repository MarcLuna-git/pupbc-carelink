<?php

namespace Tests\Feature;

use App\Mail\StudentAppointmentStatusMail;
use App\Models\Appointment;
use App\Models\AppointmentCheckin;
use App\Models\HealthProfile;
use App\Models\Notification;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

class StudentAppointmentNotificationTest extends TestCase
{
    private $studentIds = [];

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        // Real commits exercise afterCommit; never reset the existing database.
        DB::beginTransaction();
    }

    protected function tearDown(): void
    {
        try {
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            // Remove only fixtures created by this test, including committed ones.
            DB::transaction(function () {
                foreach (['notifications', 'appointment_checkins', 'appointments', 'health_profiles'] as $table) {
                    DB::table($table)->whereIn('user_id', $this->studentIds)->delete();
                }
                DB::table('users')->whereIn('id', $this->studentIds)->delete();
            });
        } finally {
            parent::tearDown();
        }
    }

    private function student(bool $complete = true): User
    {
        $student = User::create([
            'student_id' => 'NOTICE-' . Str::random(10),
            'first_name' => 'Notification', 'last_name' => 'Test',
            'email' => Str::uuid() . '@example.test', 'password' => 'unused',
            'birthday' => '2002-05-15', 'role' => 'student', 'status' => null,
        ]);
        $this->studentIds[] = $student->id;
        if ($complete) {
            HealthProfile::create([
                'user_id' => $student->id, 'emergency_name' => 'Guardian',
                'emergency_relationship' => 'Parent', 'emergency_phone' => '09123456789',
                'consent_signature' => 'Test', 'consent_date' => today()->toDateString(),
                'agree_privacy' => true, 'agree_terms' => true,
            ]);
        }
        return $student;
    }

    private function booking(): array
    {
        $date = Carbon::today('Asia/Manila')->addYears(2);
        if ($date->isSunday()) {
            $date->addDay();
        }
        return ['service' => 'Consultation', 'appointment_date' => $date->toDateString(),
            'time_slot' => '9:00 AM', 'concern' => 'Private concern must not appear in email'];
    }

    private function appointment(User $student, string $status = 'pending'): Appointment
    {
        return Appointment::create(array_merge($this->booking(), [
            'user_id' => $student->id, 'status' => $status,
        ]));
    }

    private function cancel(Appointment $appointment)
    {
        return $this->patchJson('/api/student/appointments/' . $appointment->id . '/cancel');
    }

    private function assertNotice(User $student, Appointment $appointment, string $status): void
    {
        $rows = Notification::where('user_id', $student->id)->get();
        $this->assertCount(1, $rows);
        $this->assertSame('appointment_' . $status, $rows[0]->type);
        $this->assertFalse($rows[0]->read);
        $this->assertSame($appointment->id, $rows[0]->data['appointment_id']);
        $this->assertSame($appointment->reference_number, $rows[0]->data['reference_number']);
        $this->assertSame($status, $rows[0]->data['status']);
    }

    private function assertMail(User $student, Appointment $appointment, string $status): void
    {
        Mail::assertSent(StudentAppointmentStatusMail::class, 1);
        Mail::assertNothingQueued();
        Mail::assertSent(StudentAppointmentStatusMail::class, function ($mail) use ($student, $appointment, $status) {
            $this->assertSame([['name' => null, 'address' => $student->email]], $mail->to);
            $this->assertSame([], $mail->cc);
            $this->assertSame([], $mail->bcc);
            $this->assertSame($appointment->id, $mail->appointmentId);
            $this->assertSame($status, $mail->status);
            $mail->build();
            $html = view($mail->view, $mail->buildViewData())->render();
            $this->assertStringContainsString($appointment->reference_number, $html);
            $this->assertStringContainsString($appointment->appointment_date->format('M j, Y'), $html);
            $this->assertStringContainsString($appointment->time_slot, $html);
            $this->assertStringNotContainsString($appointment->concern, $html);
            $this->assertStringContainsString($status === 'pending' ? 'pending clinic approval' : 'cancelled at your request', $html);
            return $mail->hasTo($student->email);
        });
    }

    public function test_submission_notifies_only_owner_once_after_commit_and_duplicate_is_silent(): void
    {
        $student = $this->student();
        $other = $this->student();
        $response = $this->actingAs($student, 'api')->postJson('/api/student/appointments',
            array_merge($this->booking(), ['user_id' => $other->id, 'email' => $other->email]))
            ->assertCreated()->assertJsonPath('data.status', 'pending');
        $appointment = Appointment::findOrFail($response->json('data.id'));
        $this->assertNotice($student, $appointment, 'pending');
        $this->assertSame(0, Notification::where('user_id', $other->id)->count());
        Mail::assertNothingSent();
        DB::commit();
        $this->assertMail($student, $appointment, 'pending');
        $this->postJson('/api/student/appointments', $this->booking())->assertUnprocessable();
        $this->assertNotice($student, $appointment, 'pending');
        Mail::assertSent(StudentAppointmentStatusMail::class, 1);
    }

    public function test_pending_and_approved_cancellation_notify_once_and_keep_queue_rules(): void
    {
        foreach (['pending', 'approved'] as $status) {
            Mail::fake();
            $student = $this->student();
            $appointment = $this->appointment($student, $status);
            $checkin = AppointmentCheckin::create([
                'appointment_id' => $appointment->id, 'user_id' => $student->id,
                'queue_number' => 'R-999', 'queue_type' => 'regular', 'status' => 'waiting',
                'checked_in_at' => now(), 'check_in_time' => now(),
            ]);
            $this->actingAs($student, 'api');
            $this->cancel($appointment)->assertOk()->assertJsonPath('data.status', 'cancelled');
            $this->assertSame('no_show', $checkin->fresh()->status);
            $this->assertNotice($student, $appointment, 'cancelled');
            Mail::assertNothingSent();
            DB::commit();
            $this->assertMail($student, $appointment, 'cancelled');
            $this->cancel($appointment)->assertUnprocessable();
            $this->assertNotice($student, $appointment, 'cancelled');
            Mail::assertSent(StudentAppointmentStatusMail::class, 1);
            DB::beginTransaction();
        }
    }

    public function test_invalid_booking_and_incomplete_profile_send_nothing(): void
    {
        $student = $this->student(false);
        $this->actingAs($student, 'api')->postJson('/api/student/appointments', $this->booking())->assertUnprocessable();
        $other = $this->student();
        $this->actingAs($other, 'api')->postJson('/api/student/appointments', [])->assertUnprocessable();
        DB::commit();
        $this->assertSame(0, Notification::whereIn('user_id', $this->studentIds)->count());
        $this->assertSame(0, Appointment::whereIn('user_id', $this->studentIds)->count());
        Mail::assertNothingSent();
    }

    public function test_foreign_missing_and_serving_appointments_cannot_be_cancelled(): void
    {
        $student = $this->student();
        $other = $this->student();
        $foreign = $this->appointment($other);
        $this->actingAs($student, 'api');
        $this->cancel($foreign)->assertNotFound();
        $this->patchJson('/api/student/appointments/' . Str::uuid() . '/cancel')->assertNotFound();
        $own = $this->appointment($student, 'approved');
        AppointmentCheckin::create([
            'appointment_id' => $own->id, 'user_id' => $student->id,
            'queue_number' => 'R-998', 'queue_type' => 'regular', 'status' => 'serving',
            'checked_in_at' => now(), 'check_in_time' => now(),
        ]);
        $this->cancel($own)->assertStatus(409);
        DB::commit();
        $this->assertSame('pending', $foreign->fresh()->status);
        $this->assertSame('approved', $own->fresh()->status);
        $this->assertSame(0, Notification::whereIn('user_id', $this->studentIds)->count());
        Mail::assertNothingSent();
    }

    public function test_failed_submission_transaction_discards_notification_and_email_callback(): void
    {
        $student = $this->student();
        $cache = \Mockery::mock(Cache::getFacadeRoot());
        $cache->shouldReceive('forget')->with('nurse_dashboard_stats')->once()
            ->andThrow(new \RuntimeException('Simulated failure after notification registration'));
        Cache::swap($cache);
        $this->actingAs($student, 'api')->postJson('/api/student/appointments', $this->booking())->assertStatus(500);
        DB::commit();
        $this->assertSame(0, Appointment::where('user_id', $student->id)->count());
        $this->assertSame(0, Notification::where('user_id', $student->id)->count());
        Mail::assertNothingSent();
    }

    public function test_failed_cancellation_rolls_back_status_notification_and_email_callback(): void
    {
        $student = $this->student();
        $appointment = $this->appointment($student);
        $cache = \Mockery::mock(Cache::getFacadeRoot());
        $cache->shouldReceive('forget')->with('nurse_dashboard_stats')->once()
            ->andThrow(new \RuntimeException('Simulated cancellation failure'));
        Cache::swap($cache);
        $this->actingAs($student, 'api');
        $this->cancel($appointment)->assertStatus(500);
        DB::commit();
        $this->assertSame('pending', $appointment->fresh()->status);
        $this->assertSame(0, Notification::where('user_id', $student->id)->count());
        Mail::assertNothingSent();
    }

    public function test_outer_rollback_discards_successful_request_and_email(): void
    {
        $student = $this->student();
        $this->actingAs($student, 'api')->postJson('/api/student/appointments', $this->booking())->assertCreated();
        Mail::assertNothingSent();
        DB::rollBack();
        DB::transaction(function () {});
        $this->assertSame(0, Appointment::where('user_id', $student->id)->count());
        $this->assertSame(0, Notification::where('user_id', $student->id)->count());
        Mail::assertNothingSent();
    }

    public function test_mail_transport_failure_does_not_fail_or_repeat_committed_booking(): void
    {
        $student = $this->student();
        DB::commit();
        // Replace the fake with a throwing mock; no transport is ever contacted.
        Mail::shouldReceive('to')->once()->with($student->email)->andReturnSelf();
        Mail::shouldReceive('send')->once()->andThrow(new \RuntimeException('Mail unavailable'));
        Log::shouldReceive('error')->once()->with('Student appointment email delivery failed.', \Mockery::type('array'));
        $response = $this->actingAs($student, 'api')->postJson('/api/student/appointments', $this->booking())->assertCreated();
        $appointment = Appointment::findOrFail($response->json('data.id'));
        $this->assertNotice($student, $appointment, 'pending');
        $this->assertSame(1, Appointment::where('user_id', $student->id)->count());
    }

    public function test_transaction_retry_sends_only_the_successful_attempt_email(): void
    {
        $student = $this->student();
        DB::commit();
        $attempts = 0;
        $cache = \Mockery::mock(Cache::getFacadeRoot());
        $cache->shouldReceive('forget')->with('nurse_dashboard_stats')->twice()
            ->andReturnUsing(function () use (&$attempts) {
                if (++$attempts === 1) {
                    throw new \PDOException('Simulated serialization failure', 40001);
                }
                return true;
            });
        Cache::swap($cache);
        $response = $this->actingAs($student, 'api')->postJson('/api/student/appointments', $this->booking())->assertCreated();
        $appointment = Appointment::findOrFail($response->json('data.id'));
        $this->assertSame(2, $attempts);
        $this->assertSame(1, Appointment::where('user_id', $student->id)->count());
        $this->assertNotice($student, $appointment, 'pending');
        $this->assertMail($student, $appointment, 'pending');
    }

    public function test_terminal_statuses_cannot_emit_cancellation_notifications_or_mail(): void
    {
        $student = $this->student();
        $this->actingAs($student, 'api');
        foreach (['rejected', 'completed', 'cancelled'] as $status) {
            $appointment = $this->appointment($student, $status);
            $this->cancel($appointment)->assertUnprocessable();
            $this->assertSame($status, $appointment->fresh()->status);
        }
        DB::commit();
        $this->assertSame(0, Notification::where('user_id', $student->id)->count());
        Mail::assertNothingSent();
    }
}
