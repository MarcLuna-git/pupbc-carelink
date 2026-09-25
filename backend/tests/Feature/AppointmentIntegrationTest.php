<?php

namespace Tests\Feature;

use App\Mail\StudentAppointmentStatusMail;
use App\Models\{Appointment, HealthProfile, Notification, User};
use Carbon\Carbon;
use Illuminate\Support\Facades\{DB, Log, Mail};
use Illuminate\Support\Str;
use Tests\TestCase;

class AppointmentIntegrationTest extends TestCase
{
    private $users = [];
    private $timezone;

    protected function setUp(): void
    {
        parent::setUp();
        $this->timezone = date_default_timezone_get();
        config(['app.timezone' => 'Asia/Manila']);
        date_default_timezone_set('Asia/Manila');
        Carbon::setTestNow(Carbon::parse('2026-09-23 12:00:00', 'Asia/Manila'));
        Mail::fake();
        DB::beginTransaction();
    }

    protected function tearDown(): void
    {
        try {
            while (DB::transactionLevel() > 0) DB::rollBack();
            // After-commit tests clean up only their own generated fixtures.
            DB::transaction(function () {
                foreach (['notifications', 'audit_logs', 'appointment_checkins', 'appointments', 'health_profiles', 'qr_codes'] as $table) {
                    DB::table($table)->whereIn('user_id', $this->users)->delete();
                }
                DB::table('users')->whereIn('id', $this->users)->delete();
            });
        } finally {
            Carbon::setTestNow();
            date_default_timezone_set($this->timezone);
            parent::tearDown();
        }
    }

    private function person(string $role = 'student'): User
    {
        $user = User::create([
            'student_id' => 'DATE-' . Str::random(10), 'first_name' => 'Date', 'last_name' => 'Test',
            'email' => Str::uuid() . '@example.test', 'password' => 'unused',
            'birthday' => '2002-05-15', 'role' => $role, 'status' => null,
        ]);
        $this->users[] = $user->id;
        if ($role === 'student') {
            HealthProfile::create([
                'user_id' => $user->id, 'emergency_name' => 'Guardian', 'emergency_relationship' => 'Parent',
                'emergency_phone' => '09123456789', 'consent_signature' => 'Test',
                'consent_date' => '2026-09-23', 'agree_privacy' => true, 'agree_terms' => true,
            ]);
            $user->qrCode()->create(['qr_code_hash' => Str::uuid(), 'is_active' => true]);
        }
        return $user;
    }

    private function book(User $student, string $date = '2026-09-24'): Appointment
    {
        $response = $this->actingAs($student, 'api')->postJson('/api/student/appointments', [
            'service' => 'Consultation', 'appointment_date' => $date, 'time_slot' => '8:00 AM',
        ])->assertCreated()->assertJsonPath('data.appointment_date', $date);
        return Appointment::findOrFail($response->json('data.id'));
    }

    private function eventMail(User $student, Appointment $appointment, string $event): void
    {
        Mail::assertSent(StudentAppointmentStatusMail::class, function ($mail) use ($student, $appointment, $event) {
            if ($mail->event !== $event) return false;
            $this->assertTrue($mail->hasTo($student->email));
            $this->assertCount(1, $mail->to);
            $this->assertSame([], $mail->cc);
            $this->assertSame([], $mail->bcc);
            $this->assertSame($appointment->id, $mail->appointmentId);
            $this->assertSame($appointment->appointment_date->format('M j, Y'), $mail->appointmentDate);
            $mail->build();
            $html = view($mail->view, $mail->buildViewData())->render();
            $this->assertStringContainsString($mail->appointmentDate, $html);
            $this->assertStringContainsString($appointment->time_slot, $html);
            if ($mail->reason) {
                $this->assertStringNotContainsString(e($mail->reason), $html);
                $this->assertStringContainsString('Sign in to CareLink to view the reason securely.', $html);
            }
            return true;
        });
        $notices = Notification::where('user_id', $student->id)->where('type', 'appointment_' . $event)->get();
        $this->assertCount(1, $notices);
        $this->assertSame($appointment->appointment_date->toDateString(), $notices[0]->data['appointment_date']);
    }

    public static function appointmentDates(): array
    {
        return [['2026-09-24'], ['2026-09-29']];
    }

    /** @dataProvider appointmentDates */
    public function test_booking_edit_approval_and_qr_keep_exact_calendar_date(string $date): void
    {
        $student = $this->person();
        $nurse = $this->person('nurse');
        $appointment = $this->book($student, $date);
        for ($i = 0; $i < 3; $i++) {
            $row = $this->getJson('/api/student/appointments/' . $appointment->id)->assertOk()->json('data');
            $this->assertSame($date, $row['appointment_date']);
            $this->putJson('/api/student/appointments/' . $appointment->id, [
                'service' => 'Consultation', 'appointment_date' => $row['appointment_date'], 'time_slot' => '8:00 AM',
            ])->assertOk()->assertJsonPath('data.appointment_date', $date);
        }
        $this->actingAs($nurse, 'api')->getJson('/api/nurse/appointments/' . $appointment->id)
            ->assertOk()->assertJsonPath('data.appointment_date', $date);
        $this->patchJson('/api/nurse/appointments/' . $appointment->id . '/approve')
            ->assertOk()->assertJsonPath('data.appointment_date', $date);
        $this->assertSame($date, DB::table('appointments')->where('id', $appointment->id)->value('appointment_date'));
        Mail::assertNothingSent();
        DB::commit();
        $this->patchJson('/api/nurse/appointments/' . $appointment->id . '/approve')->assertUnprocessable();
        Mail::assertSent(StudentAppointmentStatusMail::class, 2); // pending + approved
        $this->eventMail($student, $appointment, 'pending');
        $this->eventMail($student, $appointment, 'approved');
        $this->assertSame(0, Notification::where('user_id', $nurse->id)->count());

        $this->actingAs($student->fresh(), 'api')->getJson('/api/student/upcoming-appointments')
            ->assertOk()->assertJsonPath('data.0.appointment_date', $date);
        $this->getJson('/api/student/qr')->assertJsonPath('data.available', false);
        $this->withHeader('X-Kiosk-Token', config('kiosk.device_token'))
            ->postJson('/api/kiosk/lookup', ['student_id' => $student->student_id, 'method' => 'manual'])->assertUnprocessable();

        Carbon::setTestNow(Carbon::parse($date . ' 00:01:00', 'Asia/Manila'));
        config(['app.timezone' => 'UTC']);
        date_default_timezone_set('UTC'); // the clinic is already on the next day
        $this->getJson('/api/student/qr')->assertJsonPath('data.available', true)
            ->assertJsonPath('data.appointment.appointment_date', $date);
        $this->getJson('/api/student/dashboard-stats')->assertJsonPath('data.upcoming_appointments', 1);
        $this->postJson('/api/kiosk/lookup', ['student_id' => $student->student_id, 'method' => 'manual'])
            ->assertOk()->assertJsonPath('data.appointment.appointment_date', $date);
        $this->actingAs($nurse, 'api')->getJson('/api/nurse/dashboard/appointments-today')
            ->assertOk()->assertJsonPath('data.0.appointment_date', $date);
    }

    public function test_nurse_rejection_notifies_only_owner_once_with_reason(): void
    {
        $student = $this->person();
        $other = $this->person();
        $nurse = $this->person('nurse');
        $appointment = $this->book($student);
        $this->actingAs($nurse, 'api');
        $url = '/api/nurse/appointments/' . $appointment->id . '/reject';
        $this->patchJson($url, [])->assertUnprocessable();
        $this->patchJson($url, ['reason' => 'Please select another schedule'])->assertOk();
        Mail::assertNothingSent();
        DB::commit();
        $this->patchJson($url, ['reason' => 'Repeated'])->assertUnprocessable();
        Mail::assertSent(StudentAppointmentStatusMail::class, 2);
        $this->eventMail($student, $appointment, 'rejected');
        $this->assertSame(0, Notification::where('user_id', $other->id)->count());
    }

    public function test_nurse_cancellation_and_reschedule_emit_both_channels_without_duplicates(): void
    {
        $student = $this->person();
        $nurse = $this->person('nurse');
        $appointment = $this->book($student);
        $this->actingAs($nurse, 'api');
        $base = '/api/nurse/appointments/' . $appointment->id;
        $schedule = ['appointment_date' => '2026-09-29', 'time_slot' => '8:00 AM'];
        $this->patchJson($base . '/reschedule', $schedule)->assertOk()->assertJsonPath('data.appointment_date', '2026-09-29');
        DB::commit();
        $this->patchJson($base . '/reschedule', $schedule)->assertOk();
        $this->patchJson($base . '/reschedule', ['appointment_date' => '2026-09-27', 'time_slot' => '8:00 AM'])->assertUnprocessable();
        $this->patchJson($base . '/cancel', ['reason' => 'Clinic unavailable'])->assertOk();
        $this->patchJson($base . '/cancel', ['reason' => 'Repeated'])->assertUnprocessable();
        Mail::assertSent(StudentAppointmentStatusMail::class, 3);
        $this->eventMail($student, $appointment->fresh(), 'rescheduled');
        $this->eventMail($student, $appointment->fresh(), 'cancelled');
    }

    public function test_rolled_back_nurse_decision_sends_no_mail_or_notification(): void
    {
        $student = $this->person();
        $nurse = $this->person('nurse');
        $appointment = $this->book($student);
        DB::commit();
        Mail::fake();
        foreach (['approve', 'reject'] as $action) {
            DB::beginTransaction();
            $this->actingAs($nurse, 'api')->patchJson('/api/nurse/appointments/' . $appointment->id . '/' . $action,
                ['reason' => 'Not available'])->assertOk();
            Mail::assertNothingSent();
            DB::rollBack();
            $this->assertSame('pending', $appointment->fresh()->status);
        }
        DB::transaction(function () {});
        Mail::assertNothingSent();
        $this->assertSame(1, Notification::where('user_id', $student->id)->count()); // original booking only
    }

    public function test_nurse_mail_failure_is_logged_without_rolling_back_approval(): void
    {
        $student = $this->person();
        $nurse = $this->person('nurse');
        $appointment = $this->book($student);
        DB::commit();
        Mail::shouldReceive('to')->once()->with($student->email)->andReturnSelf();
        Mail::shouldReceive('send')->once()->andThrow(new \RuntimeException('Simulated SMTP failure'));
        Log::shouldReceive('error')->once()->with('Student appointment email delivery failed.', \Mockery::on(function ($context) use ($appointment) {
            return $context['appointment_id'] === $appointment->id && $context['event'] === 'approved';
        }));
        $this->actingAs($nurse, 'api')->patchJson('/api/nurse/appointments/' . $appointment->id . '/approve')->assertOk();
        $this->assertSame('approved', $appointment->fresh()->status);
        $this->assertDatabaseHas('notifications', ['user_id' => $student->id, 'type' => 'appointment_approved']);
    }

    public function test_expiration_uses_manila_day_and_notifies_once(): void
    {
        $student = $this->person();
        $appointment = $this->book($student);
        Carbon::setTestNow(Carbon::parse('2026-09-25 00:01:00', 'Asia/Manila'));
        config(['app.timezone' => 'UTC']); date_default_timezone_set('UTC');
        // Restrict the command to this fixture so a real commit cannot expire
        // any appointments that already existed in the isolated test database.
        $scopes = new \ReflectionProperty(Appointment::class, 'globalScopes');
        $scopes->setAccessible(true);
        $originalScopes = $scopes->getValue();
        Appointment::addGlobalScope('integration_fixture', function ($query) use ($student) {
            $query->where('user_id', $student->id);
        });
        try {
            $this->artisan('appointments:expire')->assertExitCode(0);
            $this->artisan('appointments:expire')->assertExitCode(0);
        } finally {
            $scopes->setValue(null, $originalScopes);
        }
        $this->assertSame('expired', $appointment->fresh()->status);
        $this->assertSame(1, Notification::where('user_id', $student->id)->where('type', 'appointment_expired')->count());
        Mail::assertNothingSent();
        DB::commit();
        Mail::assertSent(StudentAppointmentStatusMail::class, 2);
        $this->eventMail($student, $appointment, 'expired');
    }

    public function test_archive_cancellation_sends_to_the_archived_student_after_commit(): void
    {
        $student = $this->person();
        $nurse = $this->person('nurse');
        $appointment = $this->book($student);
        $this->actingAs($nurse, 'api')->patchJson('/api/nurse/students/' . $student->id . '/archive',
            ['reason' => 'No longer enrolled'])->assertOk();
        Mail::assertNothingSent();
        DB::commit();
        Mail::assertSent(StudentAppointmentStatusMail::class, 2);
        Mail::assertSent(StudentAppointmentStatusMail::class, function ($mail) use ($student, $appointment) {
            return $mail->event === 'cancelled' && $mail->appointmentId === $appointment->id
                && $mail->hasTo($student->email) && $mail->reason === 'No longer enrolled';
        });
        $this->assertSoftDeleted('users', ['id' => $student->id]);
    }

    public function test_email_template_renders_with_real_array_transport_without_smtp(): void
    {
        $student = $this->person();
        $appointment = $this->book($student);
        // An array transport exercises Laravel's reserved view variables without
        // contacting SMTP; Mail::fake alone does not render a real message.
        $manager = new \Illuminate\Mail\MailManager($this->app);
        foreach (['approved', 'rejected', 'cancelled', 'rescheduled', 'expired'] as $event) {
            $mail = new StudentAppointmentStatusMail($appointment, $event);
            $manager->mailer('array')->to($student->email)->send($mail);
        }
        $this->assertCount(5, $manager->mailer('array')->getSwiftMailer()->getTransport()->messages());
    }
}
