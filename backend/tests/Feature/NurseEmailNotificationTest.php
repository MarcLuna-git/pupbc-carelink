<?php

namespace Tests\Feature;

use App\Mail\NurseNotificationMail;
use App\Models\{Appointment, HealthProfile, Medicine, MedicineBatch, Notification, User};
use Carbon\Carbon;
use Illuminate\Support\Facades\{DB, Hash, Mail};
use Illuminate\Support\Str;
use Tests\TestCase;

class NurseEmailNotificationTest extends TestCase
{
    private $users = [];
    private $medicines = [];
    private $timezone;

    protected function setUp(): void
    {
        parent::setUp();
        $this->timezone = date_default_timezone_get();
        config(['app.timezone' => 'Asia/Manila']);
        date_default_timezone_set('Asia/Manila');
        Carbon::setTestNow(Carbon::parse('2026-09-23 12:00:00', 'Asia/Manila'));
        Mail::fake();
        // After-commit emails only run on a real commit, so these tests commit and clean up their own rows.
        DB::beginTransaction();
    }

    protected function tearDown(): void
    {
        try {
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            DB::transaction(function () {
                DB::table('medicine_stock_movements')->whereIn('medicine_id', $this->medicines)->delete();
                DB::table('medicine_batches')->whereIn('medicine_id', $this->medicines)->delete();
                DB::table('medicines')->whereIn('id', $this->medicines)->delete();
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
            'student_id' => 'NMAIL-' . Str::random(10), 'first_name' => 'Mail', 'last_name' => ucfirst($role),
            'email' => Str::uuid() . '@example.test', 'password' => Hash::make('TestPassword123!'),
            'birthday' => '2002-05-15', 'role' => $role, 'status' => null,
        ]);
        $this->users[] = $user->id;
        if ($role === 'student') {
            HealthProfile::create([
                'user_id' => $user->id, 'emergency_name' => 'Guardian', 'emergency_relationship' => 'Parent',
                'emergency_phone' => '+639123456789', 'consent_signature' => 'Test',
                'consent_date' => '2026-09-23', 'agree_privacy' => true, 'agree_terms' => true,
            ]);
            $user->qrCode()->create(['qr_code_hash' => Str::uuid(), 'is_active' => true]);
        }

        return $user;
    }

    private function sentTo(User $user, ?string $title = null): int
    {
        return Mail::sent(NurseNotificationMail::class, fn ($mail) => $mail->hasTo($user->email) && ($title === null || $mail->title === $title))->count();
    }

    public function test_a_booking_emails_every_nurse_and_never_a_student(): void
    {
        $nurse = $this->person('nurse');
        $otherNurse = $this->person('nurse');
        $student = $this->person();

        $this->actingAs($student, 'api')->postJson('/api/student/appointments', [
            'service' => 'Consultation', 'appointment_date' => '2026-09-24', 'time_slot' => '8:00 AM',
        ])->assertCreated();
        // The emails go out after commit; commit here as the request would in production.
        DB::commit();

        $this->assertSame(1, $this->sentTo($nurse, 'New appointment booked'));
        $this->assertSame(1, $this->sentTo($otherNurse, 'New appointment booked'));
        $this->assertSame(0, $this->sentTo($student));

        $mail = Mail::sent(NurseNotificationMail::class, fn ($mail) => $mail->hasTo($nurse->email))->first();
        $this->assertStringContainsString('booked an appointment for Sep 24, 2026 at 8:00 AM', $mail->body);
        $this->assertSame('appointment_booked', $mail->type);
    }

    public function test_a_student_cancelling_emails_the_nurses(): void
    {
        $nurse = $this->person('nurse');
        $student = $this->person();
        $appointment = Appointment::create(['user_id' => $student->id, 'service' => 'Consultation', 'appointment_date' => '2026-09-24', 'time_slot' => '9:00 AM', 'status' => 'pending']);

        $this->actingAs($student, 'api')->patchJson('/api/student/appointments/' . $appointment->id . '/cancel')->assertOk();
        // The emails go out after commit; commit here as the request would in production.
        DB::commit();

        $this->assertSame(1, $this->sentTo($nurse, 'Student cancelled an appointment'));
    }

    public function test_running_low_on_a_medicine_emails_the_nurses(): void
    {
        $nurse = $this->person('nurse');
        $student = $this->person();
        $medicine = Medicine::create(['name' => 'Mail Med ' . Str::random(6), 'quantity' => 3, 'minimum_stock' => 2, 'unit' => 'tablet']);
        $this->medicines[] = $medicine->id;

        $this->actingAs($nurse, 'api')->postJson('/api/nurse/medicines/' . $medicine->id . '/movements', [
            'movement_type' => 'dispensed', 'quantity' => 2, 'reason' => 'Visit', 'student_id' => $student->student_id,
        ], ['If-Match' => $medicine->fresh()->sync_version])->assertOk();
        // The emails go out after commit; commit here as the request would in production.
        DB::commit();

        $this->assertSame(1, $this->sentTo($nurse, 'Low Medicine Stock'));
    }

    public function test_other_notifications_and_other_users_are_not_emailed(): void
    {
        $nurse = $this->person('nurse');
        $student = $this->person();

        // Not one of the actionable types.
        Notification::create(['user_id' => $nurse->id, 'type' => 'consultation_completed', 'title' => 'Consultation Recorded', 'message' => 'Done.']);
        // A student, even with a nurse-style type, is never emailed by this feature.
        Notification::create(['user_id' => $student->id, 'type' => 'appointment_booked', 'title' => 'New appointment booked', 'message' => 'Hello.']);
        DB::commit();

        Mail::assertNotSent(NurseNotificationMail::class);
    }

    public function test_the_nurse_emails_can_be_switched_off(): void
    {
        config(['mail.nurse_notifications' => false]);
        $nurse = $this->person('nurse');
        Notification::create(['user_id' => $nurse->id, 'type' => 'medicine_out_of_stock', 'title' => 'Medicine Out of Stock', 'message' => 'X is out of stock.']);
        DB::commit();

        Mail::assertNotSent(NurseNotificationMail::class);
        $this->assertDatabaseHas('notifications', ['user_id' => $nurse->id, 'type' => 'medicine_out_of_stock']);
    }

    public function test_staging_test_mode_still_redirects_these_emails(): void
    {
        // The existing MessageSending listener rewrites every recipient in test mode.
        config(['mail.test_mode' => true, 'mail.test_recipient' => 'delivered@resend.dev']);
        $nurse = $this->person('nurse');
        Notification::create(['user_id' => $nurse->id, 'type' => 'medicine_low_stock', 'title' => 'Low Medicine Stock', 'message' => 'X is low.']);
        DB::commit();

        // Mail::fake skips the transport, so assert the mail was addressed to the nurse
        // and that the listener (shared with the student emails) is registered.
        $this->assertSame(1, $this->sentTo($nurse, 'Low Medicine Stock'));
        $this->assertTrue(\Illuminate\Support\Facades\Event::hasListeners(\Illuminate\Mail\Events\MessageSending::class));
    }
}
