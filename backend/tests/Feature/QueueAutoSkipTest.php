<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\AppointmentCheckin;
use App\Models\Consultation;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

/*
 * A called student has one minute to arrive; after that they are skipped automatically and
 * stay in the queue until their appointment deadline. The nurse can Recall them if they return.
 */
class QueueAutoSkipTest extends TestCase
{
    use DatabaseTransactions;

    private $start;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        // Check-in is open from 15 minutes before to 30 minutes after the 4:30 PM slot used below.
        $this->start = Carbon::now('Asia/Manila')->setTime(16, 30);
        Carbon::setTestNow($this->start->copy());
    }

    private function person(string $role = 'student'): User
    {
        return User::create([
            'student_id' => 'QAS-' . Str::random(10), 'first_name' => 'Queue', 'last_name' => ucfirst($role) . Str::random(4),
            'email' => Str::uuid() . '@example.test', 'password' => Hash::make('TestPassword123!'),
            'birthday' => '2002-05-15', 'role' => $role, 'status' => null,
        ]);
    }

    private function visit(): array
    {
        $student = $this->person();
        $appointment = Appointment::create(['user_id' => $student->id, 'service' => 'General Checkup', 'appointment_date' => today()->toDateString(), 'time_slot' => '4:30 PM', 'status' => 'approved']);
        $response = $this->withHeader('X-Kiosk-Token', config('kiosk.device_token'))->postJson('/api/kiosk/checkin', [
            'student_id' => $student->student_id, 'method' => 'manual', 'chief_complaint' => 'Headache', 'severity' => 'mild', 'red_flags' => ['none'],
        ])->assertCreated();

        return [$student, $appointment, AppointmentCheckin::findOrFail($response->json('data.id'))];
    }

    private function elapse(int $seconds): void
    {
        Carbon::setTestNow(now()->addSeconds($seconds));
    }

    private function status(AppointmentCheckin $checkin): string
    {
        return $this->getJson('/api/nurse/queue/checkins')->assertOk()->json('data.' . $this->rowIndex($checkin) . '.status');
    }

    private function rowIndex(AppointmentCheckin $checkin): int
    {
        $ids = collect($this->getJson('/api/nurse/queue/checkins')->json('data'))->pluck('id')->values();

        return (int) $ids->search($checkin->id);
    }

    private function act(AppointmentCheckin $checkin, string $action)
    {
        return $this->postJson('/api/nurse/queue/' . $checkin->id . '/' . $action, [], ['If-Match' => $checkin->fresh()->sync_version]);
    }

    public function test_a_called_student_is_skipped_automatically_after_one_minute(): void
    {
        $this->actingAs($this->person('nurse'), 'api');
        [, , $checkin] = $this->visit();
        $this->postJson('/api/nurse/queue/call-next')->assertOk()->assertJsonPath('data.status', 'called');
        $queueNumber = $checkin->fresh()->queue_number;

        $this->elapse(59);
        $this->assertSame('called', $this->status($checkin));

        $this->elapse(2); // 61 seconds after the call
        $this->assertSame('skipped', $this->status($checkin));

        $skipped = $checkin->fresh();
        $this->assertNull($skipped->skipped_by);
        $this->assertNotNull($skipped->skipped_at);
        // Still in the queue with the same identity.
        $this->assertSame($queueNumber, $skipped->queue_number);
        $this->assertSame(1, collect($this->getJson('/api/nurse/queue/checkins')->json('data'))->where('id', $checkin->id)->count());
    }

    public function test_arriving_inside_the_minute_starts_the_consultation_and_late_arrival_is_refused(): void
    {
        $this->actingAs($this->person('nurse'), 'api');
        [, , $onTime] = $this->visit();
        $this->postJson('/api/nurse/queue/call-next')->assertOk();
        $this->elapse(45);
        $this->act($onTime, 'arrived')->assertOk()->assertJsonPath('data.status', 'serving');
        // Serving patients are never auto-skipped.
        $this->elapse(600);
        $this->assertSame('serving', $this->status($onTime));
    }

    public function test_arrival_after_the_minute_is_refused_and_recall_calls_the_student_again(): void
    {
        $this->actingAs($this->person('nurse'), 'api');
        [, , $checkin] = $this->visit();
        $this->postJson('/api/nurse/queue/call-next')->assertOk();
        $this->elapse(70);

        $this->act($checkin, 'arrived')->assertStatus(409);
        $this->assertSame('skipped', $checkin->fresh()->status);

        // The student came back: Recall calls them again and the one-minute timer restarts.
        $this->act($checkin, 'recall')->assertOk();
        $this->assertSame('called', $checkin->fresh()->status);
        $this->assertNotNull($checkin->fresh()->returned_at);
        $this->elapse(30);
        $this->assertSame('called', $this->status($checkin));
        $this->act($checkin, 'arrived')->assertOk()->assertJsonPath('data.status', 'serving');
    }

    public function test_manual_skip_and_mark_returned_endpoints_no_longer_exist(): void
    {
        $this->actingAs($this->person('nurse'), 'api');
        [, , $checkin] = $this->visit();

        // 404 or 405 (the path matches another route's URL); either way no action runs.
        $this->assertContains($this->act($checkin, 'skip')->getStatusCode(), [404, 405]);
        $this->assertContains($this->act($checkin, 'returned')->getStatusCode(), [404, 405]);
        $this->assertSame('waiting', $checkin->fresh()->status);
    }

    public function test_a_visit_left_serving_on_an_earlier_day_does_not_block_call_next(): void
    {
        $this->actingAs($this->person('nurse'), 'api');
        [, , $old] = $this->visit();
        \Illuminate\Support\Facades\DB::table('appointment_checkins')->where('id', $old->id)
            ->update(['status' => 'serving', 'created_at' => now()->subDay(), 'updated_at' => now()->subDay()]);
        [, , $today] = $this->visit();

        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/nurse/queue/call-next')
            ->assertOk()->assertJsonPath('data.id', $today->id);

        // Today's called student still holds the desk: nobody else can be called meanwhile.
        [, , $another] = $this->visit();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/nurse/queue/call-next')->assertStatus(409);
        $this->assertSame('waiting', $another->fresh()->status);
    }

    public function test_a_queued_visit_cannot_be_approved_or_rejected_again(): void
    {
        $this->actingAs($this->person('nurse'), 'api');
        [, $appointment] = $this->visit();

        $this->patchJson('/api/nurse/appointments/' . $appointment->id . '/approve')->assertUnprocessable();
        $this->patchJson('/api/nurse/appointments/' . $appointment->id . '/reject', ['reason' => 'No'])->assertUnprocessable();
        $this->assertSame('approved', $appointment->fresh()->status);
    }

    public function test_a_visit_still_waiting_after_its_day_is_closed_and_flagged_no_show(): void
    {
        $this->actingAs($this->person('nurse'), 'api');
        [, $appointment, $checkin] = $this->visit();

        // Later the same day nothing changes: the student is still in today's queue.
        $this->elapse(60 * 60);
        app(\App\Services\AppointmentExpiry::class)->run();
        $this->assertSame('waiting', $checkin->fresh()->status);

        // The next day the visit can no longer be served, so it is closed.
        $this->elapse(24 * 60 * 60);
        app(\App\Services\AppointmentExpiry::class)->run();

        $this->assertSame('no_show', $checkin->fresh()->status);
        $this->assertNotNull($checkin->fresh()->no_show_at);
        // A successful check-in is never undone: the appointment stays approved, flagged no_show.
        $this->assertSame('approved', $appointment->fresh()->status);
        $this->assertTrue((bool) $appointment->fresh()->no_show);
        $row = collect($this->getJson('/api/nurse/appointments')->assertOk()->json('data.data'))->firstWhere('id', $appointment->id);
        $this->assertTrue($row['no_show']);
    }

    public function test_recalling_a_called_student_restarts_the_timer(): void
    {
        $this->actingAs($this->person('nurse'), 'api');
        [, , $checkin] = $this->visit();
        $this->postJson('/api/nurse/queue/call-next')->assertOk();
        $this->elapse(50);
        $this->act($checkin, 'recall')->assertOk();
        $this->elapse(30); // 80 seconds after the first call, 30 after the recall
        $this->assertSame('called', $this->status($checkin));
        $this->elapse(31);
        $this->assertSame('skipped', $this->status($checkin));
    }

    public function test_a_skipped_student_cannot_be_recalled_while_someone_else_is_called_or_served(): void
    {
        $this->actingAs($this->person('nurse'), 'api');
        [, , $first] = $this->visit();
        [, , $second] = $this->visit();
        $first->update(['check_in_time' => now()->subMinutes(2)]);
        $this->postJson('/api/nurse/queue/call-next')->assertOk()->assertJsonPath('data.id', $first->id);
        $this->elapse(61);
        $this->assertSame('skipped', $this->status($first));

        // The next waiting student is called; the skipped one has to wait for them to finish.
        $this->postJson('/api/nurse/queue/call-next')->assertOk()->assertJsonPath('data.id', $second->id);
        $this->act($first, 'recall')->assertStatus(409);
        $this->assertSame('skipped', $first->fresh()->status);
    }

    public function test_a_skipped_student_becomes_a_no_show_at_the_deadline_and_cannot_be_recalled(): void
    {
        $this->actingAs($this->person('nurse'), 'api');
        [, , $checkin] = $this->visit();
        $this->postJson('/api/nurse/queue/call-next')->assertOk();
        $this->elapse(61);
        $this->assertSame('skipped', $this->status($checkin));

        // 5:05 PM: past the 5:00 PM deadline (slot 4:30 PM + 30 minutes).
        Carbon::setTestNow($this->start->copy()->addMinutes(35));
        $this->assertSame('no_show', $this->status($checkin));
        $this->act($checkin, 'recall')->assertStatus(409);
    }

    public function test_the_queue_response_carries_the_server_clock_for_the_countdown(): void
    {
        $this->actingAs($this->person('nurse'), 'api');
        $response = $this->getJson('/api/nurse/queue/checkins')->assertOk();
        $this->assertSame(60, $response->json('call_timeout_seconds'));
        $this->assertSame(now()->toIso8601String(), $response->json('server_time'));
    }

    private function consultationPayload(User $student, Appointment $appointment, AppointmentCheckin $checkin, array $override = []): array
    {
        return array_merge([
            'user_id' => $student->id, 'appointment_id' => $appointment->id, 'appointment_checkin_id' => $checkin->id,
            'chief_complaint' => 'Headache', 'history_present_illness' => 'Since this morning',
            'nursing_assessment' => 'Alert and oriented', 'nursing_interventions' => 'Advised rest',
        ], $override);
    }

    public function test_history_assessment_and_interventions_are_required_but_other_fields_stay_optional(): void
    {
        $this->actingAs($this->person('nurse'), 'api');
        [$student, $appointment, $checkin] = $this->visit();
        $this->postJson('/api/nurse/queue/call-next')->assertOk();
        $this->act($checkin, 'arrived')->assertOk();

        foreach (['chief_complaint' => 'chief complaint', 'history_present_illness' => 'history', 'nursing_assessment' => 'nursing assessment', 'nursing_interventions' => 'nursing interventions'] as $field => $word) {
            foreach ([null, '', '   '] as $blank) {
                $response = $this->postJson('/api/nurse/consultations', $this->consultationPayload($student, $appointment, $checkin, [$field => $blank]))
                    ->assertUnprocessable()->assertJsonValidationErrors($field);
                $this->assertStringContainsString($word, strtolower($response->json('errors.' . $field . '.0')));
            }
        }
        $this->assertSame(0, Consultation::where('appointment_checkin_id', $checkin->id)->count());
        $this->assertSame('serving', $checkin->fresh()->status);

        // Without vitals, treatment plan, remarks, certificate or follow-up it saves.
        $this->postJson('/api/nurse/consultations', $this->consultationPayload($student, $appointment, $checkin))->assertCreated();
        $this->assertSame('completed', $checkin->fresh()->status);
    }
}
