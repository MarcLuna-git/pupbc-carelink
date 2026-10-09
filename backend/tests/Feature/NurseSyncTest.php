<?php

namespace Tests\Feature;

use App\Models\Medicine;
use App\Models\User;
use App\Services\NurseSync;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/** Isolated SQLite HTTP tests. Production row-lock contention requires MySQL/Postgres testing. */
class NurseSyncTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:' . base64_encode(str_repeat('t', 32))]);
        config(['database.default' => 'sync_testing', 'database.connections.sync_testing' => [
            'driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true,
        ]]);
        // Each test owns a new in-memory connection, including its operation ledger.
        DB::purge('sync_testing');
        config(['cache.default' => 'array', 'kiosk.device_token' => str_repeat('k', 32)]);
        Mail::fake();
        $this->withoutMiddleware(\App\Http\Middleware\ExpireStaleAppointments::class);
        foreach ([
            '2024_01_01_000000_create_users_table.php',
            '2026_07_04_180948_create_health_profiles_table.php',
            '2026_07_04_181046_create_appointments_table.php',
            '2026_07_05_104955_create_appointment_checkins_table.php',
            '2026_07_04_181119_create_consultations_table.php',
            '2026_09_07_000001_add_visit_triage_and_emergency_encounters.php',
            '2026_07_05_110006_create_audit_logs_table.php',
            '2026_07_09_071005_create_medicines_table.php',
            '2026_07_05_105927_create_notifications_table.php',
            '2026_07_05_110023_create_qr_codes_table.php',
            '2026_09_23_000004_create_medicine_batches_and_movements.php',
            '2026_10_04_000001_add_student_reference_to_medicine_stock_movements.php',
        ] as $file) {
            if ($file === '2026_07_04_181046_create_appointments_table.php') {
                // Model the post-lifecycle status CHECK in fresh SQLite only.
                // SQLite cannot ALTER the original CHECK as PostgreSQL can.
                Schema::create('appointments', function (Blueprint $table) {
                    $table->uuid('id')->primary();
                    $table->foreignUuid('user_id')->constrained('users')->onDelete('cascade');
                    $table->string('service');
                    $table->date('appointment_date');
                    $table->string('time_slot');
                    $table->text('concern')->nullable();
                    $table->enum('status', ['pending', 'approved', 'rejected', 'completed', 'cancelled', 'expired'])->default('pending');
                    $table->string('reference_number', 50)->unique();
                    $table->foreignUuid('approved_by')->nullable()->constrained('users')->onDelete('set null');
                    $table->timestamp('approved_at')->nullable();
                    $table->text('rejection_reason')->nullable();
                    $table->timestamps();
                    $table->softDeletes();
                    $table->index(['user_id', 'status']);
                    $table->index(['appointment_date', 'status']);
                });
                continue;
            }
            (require database_path('migrations/' . $file))->up();
        }
        require_once database_path('migrations/2026_10_09_000001_create_nurse_sync_tables.php');
        (new \CreateNurseSyncTables)->up();
        Schema::create('clinic_queue_locks', function (Blueprint $table) { $table->integer('id')->primary(); });
        DB::table('clinic_queue_locks')->insert(['id' => 1]);
        Schema::table('appointments', function (Blueprint $table) {
            $table->boolean('no_show')->default(false);
            $table->timestamp('checked_in_at')->nullable();
            $table->string('queue_number')->nullable();
            $table->string('queue_type')->nullable();
        });
        Schema::table('appointment_checkins', function (Blueprint $table) {
            $table->boolean('is_walk_in')->default(false);
            $table->string('status')->default('waiting');
            $table->string('queue_number')->nullable();
            $table->string('queue_type')->default('regular');
            $table->string('triage_reason')->nullable();
            $table->timestamp('check_in_time')->nullable();
            $table->timestamp('called_at')->nullable();
            $table->foreignUuid('called_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('no_show_at')->nullable();
            $table->foreignUuid('no_show_by')->nullable()->constrained('users')->onDelete('set null');
        });
        Schema::create('clinic_queue_counters', function (Blueprint $table) {
            $table->date('queue_date');
            $table->string('queue_type');
            $table->integer('last_number');
            $table->primary(['queue_date', 'queue_type']);
        });
        (require database_path('migrations/2026_10_12_000001_add_skipped_queue_audit_fields.php'))->up();
        $this->assertSame(0, \App\Models\AppointmentCheckin::count());
        $this->assertSame(0, DB::table('nurse_operations')->count());
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function person(string $role = 'nurse'): User
    {
        return User::create(['first_name' => 'Shared', 'last_name' => 'Nurse', 'email' => Str::uuid() . '@example.test',
            'student_id' => 'TEST-' . Str::random(8), 'role' => $role, 'status' => 'active', 'password' => Hash::make('TestPassword123!')]);
    }

    private function medicine(): Medicine
    {
        return Medicine::create(['name' => 'Test medicine', 'quantity' => 10, 'minimum_stock' => 0])->fresh();
    }

    public function test_sync_requires_nurse_and_contains_only_revision_metadata()
    {
        $this->getJson('/api/nurse/sync')->assertUnauthorized();
        $this->actingAs($this->person('student'), 'api')->getJson('/api/nurse/sync')->assertForbidden();
        $data = $this->actingAs($this->person(), 'api')->getJson('/api/nurse/sync')->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')->json('data');
        $this->assertEqualsCanonicalizing(['appointments', 'queue', 'consultations', 'medicines', 'students', 'academic', 'announcements', 'notifications', 'day'], array_keys($data));
    }

    public function test_two_logins_keep_both_jwt_sessions_valid()
    {
        $nurse = $this->person();
        $credentials = ['email' => $nurse->email, 'password' => 'TestPassword123!'];
        $first = $this->postJson('/api/auth/nurse-login', $credentials)->assertOk()->json('token');
        $second = $this->postJson('/api/auth/nurse-login', $credentials)->assertOk()->json('token');
        $this->assertNotEmpty($first);
        $this->assertNotSame($first, $second);
        foreach ([$first, $second, $first] as $token) {
            auth()->forgetGuards();
            $this->withToken($token)->getJson('/api/nurse/sync')->assertOk();
        }
    }

    public function test_revisions_follow_model_changes_and_roll_back_with_data()
    {
        $before = NurseSync::revisions()['medicines'];
        $medicine = $this->medicine();
        $this->assertGreaterThan($before, NurseSync::revisions()['medicines']);
        $before = NurseSync::revisions()['medicines'];
        DB::beginTransaction();
        $medicine->increment('quantity', 2);
        $this->assertGreaterThan($before, NurseSync::revisions()['medicines']);
        DB::rollBack();
        $this->assertEquals($before, NurseSync::revisions()['medicines']);
        $this->assertSame(10, $medicine->fresh()->quantity);
    }

    public function test_stock_receipt_retries_apply_once_and_conflicting_key_is_rejected()
    {
        $this->actingAs($this->person(), 'api');
        $medicine = $this->medicine();
        $this->withHeader('Idempotency-Key', (string) Str::uuid());
        $url = '/api/nurse/medicines/' . $medicine->id . '/add-stock';
        $this->postJson($url, ['quantity' => 5])->assertOk();
        $this->postJson($url, ['quantity' => 5])->assertOk();
        $this->postJson($url, ['quantity' => 6])->assertStatus(409);
        $this->assertSame(15, $medicine->fresh()->quantity);
        $this->assertSame(1, DB::table('medicine_stock_movements')->count());
        $this->assertStringNotContainsString('quantity', DB::table('nurse_operations')->value('response'));
    }

    public function test_stale_stock_snapshot_cannot_dispense_twice_or_go_negative()
    {
        $this->actingAs($this->person(), 'api');
        $student = $this->person('student');
        $medicine = $this->medicine();
        $url = '/api/nurse/medicines/' . $medicine->id . '/movements';
        $payload = ['movement_type' => 'dispensed', 'quantity' => 6, 'reason' => 'Visit', 'student_id' => $student->student_id];
        $this->withHeaders(['If-Match' => $medicine->sync_version, 'Idempotency-Key' => (string) Str::uuid()]);
        $this->postJson($url, $payload)->assertOk();
        $this->postJson($url, $payload)->assertOk(); // Replay before version check.
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson($url, $payload)->assertStatus(409);
        $this->withHeaders(['If-Match' => $medicine->fresh()->sync_version, 'Idempotency-Key' => (string) Str::uuid()])
            ->postJson($url, $payload)->assertUnprocessable();
        $this->assertSame(4, $medicine->fresh()->quantity);
        $this->assertSame(1, DB::table('medicine_stock_movements')->count());
    }

    public function test_simultaneous_edit_snapshots_do_not_silently_overwrite()
    {
        $this->actingAs($this->person(), 'api');
        $medicine = $this->medicine();
        $url = '/api/nurse/medicines/' . $medicine->id;
        $this->putJson($url, ['name' => 'Missing version'])->assertStatus(428);
        $version = $this->getJson($url)->assertOk()->json('data.sync_version');
        $this->assertSame($version, $this->getJson('/api/nurse/medicines')->assertOk()->json('data.data.0.sync_version'));
        $this->withHeader('If-Match', $version)->putJson($url, ['name' => 'First edit'])->assertOk();
        $this->putJson($url, ['name' => 'Stale edit'])->assertStatus(409);
        $this->assertSame('First edit', $medicine->fresh()->name);
        $this->deleteJson($url)->assertStatus(409);
    }

public function test_duplicate_call_next_visit_claim_and_consultation_save()
    {
        $nurse = $this->person();
        $student = $this->person('student');
        $appointment = \App\Models\Appointment::create(['user_id' => $student->id, 'service' => 'Checkup',
            'appointment_date' => today()->toDateString(), 'time_slot' => '4:30 PM', 'status' => 'approved']);
        $checkin = \App\Models\AppointmentCheckin::create(['appointment_id' => $appointment->id,
            'user_id' => $student->id, 'checked_in_at' => now(), 'status' => 'waiting', 'queue_number' => 'R-001']);
        $this->actingAs($nurse, 'api')->withToken('first-device');
        $this->withHeader('Idempotency-Key', 'first-call-operation')->postJson('/api/nurse/queue/call-next')->assertOk()->assertJsonPath('data.status', 'called')->assertJsonStructure(['data' => ['called_at']]);
        $this->postJson('/api/nurse/queue/call-next')->assertOk();
        $this->withHeader('Idempotency-Key', 'second-call-operation')->postJson('/api/nurse/queue/call-next')->assertStatus(409);
        $this->getJson('/api/nurse/queue/today')->assertOk()->assertJsonPath('data.now_called.id', $checkin->id);
        $claim = '/api/nurse/queue/' . $checkin->id . '/claim';
        $this->withHeader('Idempotency-Key', 'first-claim-operation')->postJson($claim)->assertOk();
        $this->withToken('second-device')->withHeader('Idempotency-Key', 'second-claim-operation')->postJson($claim)->assertStatus(409);
        $payload = ['user_id' => $student->id, 'appointment_id' => $appointment->id,
            'appointment_checkin_id' => $checkin->id, 'chief_complaint' => 'Headache', 'vital_signs' => ['bp' => '120/80']];
        $this->withHeader('Idempotency-Key', 'second-save-operation')->postJson('/api/nurse/consultations', $payload)->assertStatus(409);
        $this->withToken('first-device')->withHeader('Idempotency-Key', 'first-save-operation')
            ->postJson('/api/nurse/consultations', $payload)->assertCreated();
        $this->postJson('/api/nurse/consultations', $payload)->assertCreated();
        $this->withToken('second-device')->withHeader('Idempotency-Key', 'second-save-operation')
            ->postJson('/api/nurse/consultations', $payload)->assertStatus(409);
        $this->assertSame(1, \App\Models\Consultation::count());
        $this->assertSame('completed', $checkin->fresh()->status);
        $this->assertSame('completed', $appointment->fresh()->status);
        $this->assertSame(0, DB::table('nurse_visit_claims')->count());
    }

    public function test_independent_logins_have_independent_poll_budgets()
    {
        $nurse = $this->person();
        $tokens = [\Tymon\JWTAuth\Facades\JWTAuth::fromUser($nurse), \Tymon\JWTAuth\Facades\JWTAuth::fromUser($nurse)];
        foreach ($tokens as $token) {
            auth()->forgetGuards();
            $this->withToken($token);
            for ($i = 0; $i < 30; $i++) $this->getJson('/api/nurse/sync')->assertOk();
            $this->getJson('/api/nurse/sync')->assertStatus(429);
            $this->getJson('/api/nurse/medicines')->assertOk(); // Poll budget does not starve screen reads.
        }
    }

    public function test_approved_appointment_expires_at_checkin_deadline()
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:29:59', 'Asia/Manila'));
        $student = $this->person('student');
        $appointment = $this->eightAmAppointment($student);
        $expiry = app(\App\Services\AppointmentExpiry::class);
        $this->assertSame(0, $expiry->run());
        $this->assertSame('approved', $appointment->fresh()->status);
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:30:00', 'Asia/Manila'));
        $this->assertSame(1, $expiry->run());
        $this->assertSame('expired', $appointment->fresh()->status);
        $this->assertNull($appointment->fresh()->deleted_at);
        $this->assertSame(0, $expiry->run());
        $this->assertSame(1, \App\Models\Appointment::count());
    }

    public function test_checked_in_appointment_never_expires()
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 07:45:00', 'Asia/Manila'));
        $student = $this->person('student');
        $appointment = $this->eightAmAppointment($student);
        $this->kioskCheckin($student)->assertCreated();
        $checkin = \App\Models\AppointmentCheckin::firstOrFail();
        // Queue progression, including no-show, must not undo successful admission.
        Carbon::setTestNow(Carbon::parse('2026-10-13 09:00:00', 'Asia/Manila'));
        foreach (['waiting', 'called', 'serving', 'completed', 'no_show', 'skipped'] as $status) {
            $checkin->update(['status' => $status]);
            $this->assertSame(0, app(\App\Services\AppointmentExpiry::class)->run());
            $this->assertSame('approved', $appointment->fresh()->status);
        }
    }

    public function test_expired_appointment_cannot_check_in()
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:30:00', 'Asia/Manila'));
        $student = $this->person('student');
        $appointment = $this->eightAmAppointment($student);
        app(\App\Services\AppointmentExpiry::class)->run();
        $hash = (string) Str::uuid();
        DB::table('qr_codes')->insert(['id' => (string) Str::uuid(), 'user_id' => $student->id,
            'qr_code_hash' => $hash, 'is_active' => true]);
        // Even a still-active student QR cannot admit an expired appointment.
        $this->kioskCheckin($student, ['method' => 'qr', 'qr_hash' => $hash])->assertStatus(422);
        $this->kioskCheckin($student)->assertStatus(422);
        $this->assertSame('expired', $appointment->fresh()->status);
        $this->assertSame(0, \App\Models\AppointmentCheckin::count());
    }

    private function eightAmAppointment(User $student)
    {
        return \App\Models\Appointment::create(['user_id' => $student->id, 'service' => 'Checkup',
            'appointment_date' => '2026-10-12', 'time_slot' => '8:00 AM', 'status' => 'approved']);
    }

    private function kioskCheckin(User $student, array $overrides = [])
    {
        return $this->withHeader('X-Kiosk-Token', config('kiosk.device_token'))
            ->postJson('/api/kiosk/checkin', array_merge(['student_id' => $student->student_id,
                'method' => 'manual', 'chief_complaint' => 'Headache', 'severity' => 'mild',
                'red_flags' => ['none']], $overrides));
    }

    /** @dataProvider checkinBoundaries */
    public function test_checkin_window_is_server_authoritative(string $time, int $status)
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 ' . $time, 'Asia/Manila'));
        $student = $this->person('student');
        $appointment = $this->eightAmAppointment($student);
        $expiry = app(\App\Services\AppointmentExpiry::class);
        $this->assertSame('2026-10-12T08:30:00+08:00', $expiry->getCheckinDeadline($appointment)->toIso8601String());
        $this->assertSame($status === 201, $expiry->isWithinCheckinWindow($appointment));
        // Middleware stays disabled here: late admission must fail even if
        // no background/request-triggered expiry has updated stored status.
        $this->kioskCheckin($student)->assertStatus($status);
        $this->assertSame($status === 201 ? 1 : 0, \App\Models\AppointmentCheckin::count());
    }

    public static function checkinBoundaries(): array
    {
        return [['07:44:59', 422], ['07:45:00', 201], ['08:00:00', 201],
            ['08:29:59', 201], ['08:29:59.999999', 201], ['08:30:00', 422], ['08:30:01', 422]];
    }

    /** @dataProvider studentWindowMetadata */
    public function test_student_appointments_and_qr_receive_server_window_metadata(
        string $slot, string $opening, string $deadline, int $early, int $late
    ) {
        // UTC clock intentionally differs from the appointment's Manila zone.
        Carbon::setTestNow(Carbon::parse('2026-10-12 00:00:17', 'UTC'));
        config(['checkin.checkin_early_minutes' => $early, 'checkin.checkin_late_minutes' => $late]);
        $student = $this->person('student');
        \App\Models\HealthProfile::create(['user_id' => $student->id, 'emergency_name' => 'Guardian',
            'emergency_relationship' => 'Parent', 'emergency_phone' => '09123456789',
            'consent_signature' => 'Test Student', 'consent_date' => '2026-10-12',
            'agree_privacy' => true, 'agree_terms' => true]);
        $hash = (string) Str::uuid();
        $student->qrCode()->create(['qr_code_hash' => $hash, 'is_active' => true]);
        $appointment = $this->eightAmAppointment($student);
        $appointment->update(['time_slot' => $slot]);
        $this->actingAs($student, 'api');
        $expectedOpening = '2026-10-12T' . $opening . '+08:00';
        $expectedDeadline = '2026-10-12T' . $deadline . '+08:00';
        $this->getJson('/api/student/appointments')->assertOk()
            ->assertJsonPath('data.0.id', $appointment->id)
            ->assertJsonPath('data.0.appointment_date', '2026-10-12')
            ->assertJsonPath('data.0.time_slot', $slot)
            ->assertJsonPath('data.0.queue', null)
            ->assertJsonPath('data.0.checkin_opens_at', $expectedOpening)
            ->assertJsonPath('data.0.checkin_deadline_at', $expectedDeadline);
        $this->getJson('/api/student/appointments/' . $appointment->id)->assertOk()
            ->assertJsonPath('data.checkin_opens_at', $expectedOpening)
            ->assertJsonPath('data.checkin_deadline_at', $expectedDeadline);
        $this->getJson('/api/student/qr')->assertOk()
            ->assertJsonPath('data.available', true)
            ->assertJsonPath('data.qr_code_hash', $hash)
            ->assertJsonPath('data.appointment.id', $appointment->id)
            ->assertJsonPath('data.appointment.time_slot', $slot)
            ->assertJsonPath('data.appointment.checkin_opens_at', $expectedOpening)
            ->assertJsonPath('data.appointment.checkin_deadline_at', $expectedDeadline);
        $this->assertSame('approved', $appointment->fresh()->status);
    }

    public static function studentWindowMetadata(): array
    {
        return [
            ['8:00 AM', '07:45:00', '08:30:00', 15, 30],
            ['1:00 PM', '12:45:00', '13:30:00', 15, 30],
            ['4:30 PM', '16:15:00', '17:00:00', 15, 30],
            ['8:30 AM', '08:20:00', '09:15:00', 10, 45],
        ];
    }

    public function test_student_window_metadata_uses_each_records_date_and_preserves_queue_data()
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:00:00', 'Asia/Manila'));
        $student = $this->person('student');
        $past = $this->eightAmAppointment($student);
        $past->update(['appointment_date' => '2026-10-11', 'time_slot' => '1:00 PM', 'status' => 'completed']);
        $future = $this->eightAmAppointment($student);
        $future->update(['appointment_date' => '2026-10-13', 'time_slot' => '4:30 PM']);
        \App\Models\AppointmentCheckin::create(['appointment_id' => $past->id, 'user_id' => $student->id,
            'checked_in_at' => now(), 'check_in_time' => now(), 'queue_number' => 'R-001', 'status' => 'completed']);
        $this->actingAs($student, 'api')->getJson('/api/student/appointments')->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $future->id)
            ->assertJsonPath('data.0.checkin_opens_at', '2026-10-13T16:15:00+08:00')
            ->assertJsonPath('data.0.checkin_deadline_at', '2026-10-13T17:00:00+08:00')
            ->assertJsonPath('data.1.id', $past->id)
            ->assertJsonPath('data.1.status', 'completed')
            ->assertJsonPath('data.1.checkin_opens_at', '2026-10-11T12:45:00+08:00')
            ->assertJsonPath('data.1.checkin_deadline_at', '2026-10-11T13:30:00+08:00')
            ->assertJsonPath('data.1.queue.queue_number', 'R-001')
            ->assertJsonPath('data.1.queue.status', 'completed');
        $this->assertSame('2026-10-13', $future->fresh()->appointment_date->toDateString());
    }

    public function test_expiration_command_updates_status_without_browser_requests()
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:30:00', 'Asia/Manila'));
        $appointment = $this->eightAmAppointment($this->person('student'));
        $this->artisan('appointments:expire')->expectsOutput('Expired 1 appointment(s).')->assertExitCode(0);
        $this->assertSame('expired', $appointment->fresh()->status);
        $this->assertNull($appointment->fresh()->deleted_at);
    }

    public function test_expiration_middleware_checks_multiple_deadlines_and_catches_up_after_sleep()
    {
        $student = $this->person('student');
        $appointment = $this->eightAmAppointment($student);
        $later = $this->eightAmAppointment($student);
        $later->update(['time_slot' => '9:00 AM']);
        $previous = $this->eightAmAppointment($student);
        $previous->update(['appointment_date' => '2026-10-11']);
        $middleware = new \App\Http\Middleware\ExpireStaleAppointments;
        $request = \Illuminate\Http\Request::create('/api/nurse/queue/today');
        $next = function () { return response()->json(['success' => true]); };
        Carbon::setTestNow(Carbon::parse('2026-10-12 07:45:00', 'Asia/Manila'));
        $middleware->handle($request, $next);
        $this->assertSame('expired', $previous->fresh()->status);
        $this->assertSame('approved', $appointment->fresh()->status);
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:30:00', 'Asia/Manila'));
        $middleware->handle($request, $next);
        $this->assertSame('expired', $appointment->fresh()->status);
        $this->assertSame('approved', $later->fresh()->status);
        Carbon::setTestNow(Carbon::parse('2026-10-12 09:30:00', 'Asia/Manila'));
        $middleware->handle($request, $next);
        $this->assertSame('expired', $later->fresh()->status);
        $this->assertSame(3, \App\Models\Appointment::count());
    }

    public function test_competing_checkin_retries_create_only_one_entry_and_expiry_preserves_it()
    {
        // Sequential interleaving: SQLite cannot prove PostgreSQL row contention.
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:29:59', 'Asia/Manila'));
        $student = $this->person('student');
        $appointment = $this->eightAmAppointment($student);
        $first = $this->kioskCheckin($student)->assertCreated()->json('data.id');
        $this->kioskCheckin($student)->assertOk()->assertJsonPath('data.id', $first);
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:30:00', 'Asia/Manila'));
        $this->assertSame(0, app(\App\Services\AppointmentExpiry::class)->run());
        $this->kioskCheckin($student)->assertStatus(422);
        $this->assertSame(1, \App\Models\AppointmentCheckin::count());
        $this->assertSame('approved', $appointment->fresh()->status);
    }

    public function test_expiry_rechecks_a_checkin_committed_after_its_candidate_query()
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:30:00', 'Asia/Manila'));
        $student = $this->person('student');
        $appointment = $this->eightAmAppointment($student);
        $interleaved = false;
        DB::listen(function ($query) use ($student, &$interleaved) {
            if ($interleaved || strpos($query->sql, 'not exists') === false) return;
            // The candidate query has returned. Simulate an admission that
            // committed before expiry gets the shared mutex, at 08:29:59.
            $interleaved = true;
            Carbon::setTestNow(Carbon::parse('2026-10-12 08:29:59', 'Asia/Manila'));
            $this->kioskCheckin($student)->assertCreated();
            Carbon::setTestNow(Carbon::parse('2026-10-12 08:30:00', 'Asia/Manila'));
        });
        $this->assertSame(0, app(\App\Services\AppointmentExpiry::class)->run());
        $this->assertTrue($interleaved);
        $this->assertSame('approved', $appointment->fresh()->status);
        $this->assertSame(1, \App\Models\AppointmentCheckin::count());
    }

    public function test_checkin_waiting_for_the_mutex_revalidates_at_the_deadline()
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:29:59', 'Asia/Manila'));
        $student = $this->person('student');
        $this->eightAmAppointment($student);
        DB::listen(function ($query) {
            if (strpos($query->sql, 'clinic_queue_locks') !== false) {
                Carbon::setTestNow(Carbon::parse('2026-10-12 08:30:00', 'Asia/Manila'));
            }
        });
        $this->kioskCheckin($student)->assertStatus(422);
        $this->assertSame(0, \App\Models\AppointmentCheckin::count());
    }

    public function test_expired_student_qr_cannot_check_in_during_the_open_window()
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:00:00', 'Asia/Manila'));
        $student = $this->person('student');
        $this->eightAmAppointment($student);
        $hash = (string) Str::uuid();
        DB::table('qr_codes')->insert(['id' => (string) Str::uuid(), 'user_id' => $student->id,
            'qr_code_hash' => $hash, 'is_active' => true, 'expires_at' => now()]);
        $this->kioskCheckin($student, ['method' => 'qr', 'qr_hash' => $hash])->assertStatus(422);
        $this->assertSame(0, \App\Models\AppointmentCheckin::count());
        DB::table('qr_codes')->where('qr_code_hash', $hash)->update(['expires_at' => now()->addHour()]);
        $this->kioskCheckin($student, ['method' => 'qr', 'qr_hash' => $hash])->assertCreated();
    }

    public function test_called_to_serving_transition()
    {
        $nurse = $this->person();
        $student = $this->person('student');
        $appointment = \App\Models\Appointment::create([
            'user_id' => $student->id, 'service' => 'Checkup',
            'appointment_date' => today()->toDateString(), 'time_slot' => '8:00 AM', 'status' => 'approved'
        ]);
        $checkin = \App\Models\AppointmentCheckin::create([
            'appointment_id' => $appointment->id, 'user_id' => $student->id,
            'checked_in_at' => now(), 'check_in_time' => now(), 'status' => 'waiting', 'queue_number' => 'R-001'
        ]);

        $this->actingAs($nurse, 'api');

        // Call next - should set status to 'called'
        $this->withHeader('Idempotency-Key', (string) \Illuminate\Support\Str::uuid())
            ->postJson('/api/nurse/queue/call-next')
            ->assertOk()
            ->assertJsonPath('data.status', 'called')
            ->assertJsonStructure(['data' => ['called_at']]);

        $checkin->refresh();
        $this->assertSame('called', $checkin->status);
        $this->assertNotNull($checkin->called_at);

        // Patient arrives - mark as serving
        $this->postJson('/api/nurse/queue/' . $checkin->id . '/arrived')
            ->assertStatus(409)
            ->assertJsonPath('message', 'This operation key was already used for different data.');
        $this->assertSame('called', $checkin->fresh()->status);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/nurse/queue/' . $checkin->id . '/arrived')
            ->assertOk()
            ->assertJsonPath('data.status', 'serving');

        $checkin->refresh();
        $this->assertSame('serving', $checkin->status);
        // A retry replays success; a separate invalid transition still conflicts.
        $this->postJson('/api/nurse/queue/' . $checkin->id . '/arrived')->assertOk();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/nurse/queue/' . $checkin->id . '/arrived')->assertStatus(409)
            ->assertJsonPath('message', 'This patient is not in called status.');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/nurse/queue/call-next')->assertStatus(409);
        $this->assertSame('serving', $checkin->fresh()->status);
    }

    public function test_called_to_skipped_then_no_show_at_original_deadline()
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:00:00', 'Asia/Manila'));
        $nurse = $this->person();
        $student = $this->person('student');
        $appointment = \App\Models\Appointment::create([
            'user_id' => $student->id, 'service' => 'Checkup',
            'appointment_date' => today()->toDateString(), 'time_slot' => '8:00 AM', 'status' => 'approved'
        ]);
        $checkin = \App\Models\AppointmentCheckin::create([
            'appointment_id' => $appointment->id, 'user_id' => $student->id,
            'checked_in_at' => now(), 'check_in_time' => now(), 'status' => 'waiting', 'queue_number' => 'R-001'
        ]);

        $this->actingAs($nurse, 'api');

        // Call next - must call patient first before skipping.
        $this->withHeader('Idempotency-Key', (string) \Illuminate\Support\Str::uuid())
            ->postJson('/api/nurse/queue/call-next')
            ->assertOk();

        $checkin->refresh();
        $this->assertSame('called', $checkin->status);

        // Reusing Call Next's operation key for Skip remains a conflict.
        $this->postJson('/api/nurse/queue/' . $checkin->id . '/skip')
            ->assertStatus(409)
            ->assertJsonPath('message', 'This operation key was already used for different data.');
        $this->assertSame('called', $checkin->fresh()->status);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->withHeader('If-Match', $checkin->fresh()->sync_version)
            ->postJson('/api/nurse/queue/' . $checkin->id . '/skip')
            ->assertOk()
            ->assertJsonPath('data.status', 'skipped');

        $checkin->refresh();
        $this->assertSame('skipped', $checkin->status);
        $this->assertNotNull($checkin->skipped_at);
        $this->assertSame($nurse->id, $checkin->skipped_by);
        $this->assertNull($checkin->no_show_at);
        $this->postJson('/api/nurse/queue/' . $checkin->id . '/skip')->assertOk();
        $this->queueMutation($checkin, 'skip')->assertStatus(409)
            ->assertJsonPath('message', 'Only called patients can be skipped.');
        $this->getJson('/api/nurse/queue/checkins')->assertOk()->assertJsonPath('data.0.status', 'skipped');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/nurse/queue/call-next')->assertOk()->assertJsonPath('data', null);

        $this->assertFalse($appointment->fresh()->no_show);
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:29:59', 'Asia/Manila'));
        $this->getJson('/api/nurse/sync')->assertOk();
        $this->assertSame('skipped', $checkin->fresh()->status);
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:30:00', 'Asia/Manila'));
        $this->getJson('/api/nurse/sync')->assertOk();
        $this->assertSame('no_show', $checkin->fresh()->status);
        $this->assertNotNull($checkin->fresh()->no_show_at);
        $this->assertNull($checkin->fresh()->no_show_by); // server reconciliation
        $this->assertTrue($appointment->fresh()->no_show);
        $this->assertSame('approved', $appointment->fresh()->status);
        $this->assertSame(1, \App\Models\AppointmentCheckin::count());
    }

    public function test_called_near_deadline_remains_called_without_a_mandatory_timer()
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:29:59', 'Asia/Manila'));
        $nurse = $this->person();
        $student = $this->person('student');
        $appointment = \App\Models\Appointment::create([
            'user_id' => $student->id, 'service' => 'Checkup',
            'appointment_date' => today()->toDateString(), 'time_slot' => '8:00 AM', 'status' => 'approved'
        ]);
        $checkin = \App\Models\AppointmentCheckin::create([
            'appointment_id' => $appointment->id, 'user_id' => $student->id,
            'checked_in_at' => now(), 'check_in_time' => now(), 'status' => 'waiting', 'queue_number' => 'R-001'
        ]);

        $this->actingAs($nurse, 'api');

        // Call next
        $this->withHeader('Idempotency-Key', (string) \Illuminate\Support\Str::uuid())
            ->postJson('/api/nurse/queue/call-next')
            ->assertOk();

        Carbon::setTestNow(Carbon::parse('2026-10-12 09:00:00', 'Asia/Manila'));
        $this->getJson('/api/nurse/sync')->assertOk();
        $checkin->refresh();
        $this->assertSame('called', $checkin->status);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/nurse/queue/' . $checkin->id . '/no-show')->assertStatus(409);
        $this->assertSame('called', $checkin->fresh()->status);
        $this->queueMutation($checkin, 'arrived')->assertOk()->assertJsonPath('data.status', 'serving');
    }

    private function queueMutation($checkin, string $action, ?string $version = null, ?string $key = null, array $payload = [])
    {
        return $this->withHeaders(['Idempotency-Key' => $key ?: (string) Str::uuid(),
            'If-Match' => $version ?: $checkin->fresh()->sync_version])
            ->postJson('/api/nurse/queue/' . $checkin->id . '/' . $action, $payload);
    }

    private function queueVisit(string $status = 'waiting', string $priority = 'LOW')
    {
        $student = $this->person('student');
        $appointment = $this->eightAmAppointment($student);
        $checkin = \App\Models\AppointmentCheckin::create(['appointment_id' => $appointment->id,
            'user_id' => $student->id, 'checked_in_at' => now(), 'check_in_time' => now(),
            'status' => $status, 'queue_number' => 'R-' . Str::random(4)]);
        $checkin->triage()->create(['chief_complaint' => 'Headache', 'severity' => 'mild', 'priority' => $priority]);
        return $checkin;
    }

    public function test_skip_and_return_preserve_identity_priority_and_call_next_eligibility()
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:00:00', 'Asia/Manila'));
        $this->actingAs($this->person(), 'api');
        $high = $this->queueVisit('called', 'HIGH');
        $original = $high->only(['id', 'appointment_id', 'checked_in_at', 'check_in_time', 'queue_number']);
        $this->queueMutation($high, 'skip')->assertOk()->assertJsonPath('data.status', 'skipped');
        $low = $this->queueVisit();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/nurse/queue/call-next')
            ->assertOk()->assertJsonPath('data.id', $low->id);
        $this->queueMutation($low, 'arrived')->assertOk();
        $this->queueMutation($high, 'returned')->assertOk()->assertJsonPath('data.status', 'waiting');
        $this->assertEquals($original, $high->fresh()->only(array_keys($original)));
        $this->assertNotNull($high->fresh()->returned_at);
        // Complete the serving visit before advancing the queue.
        $low->update(['status' => 'completed']);
        $this->queueVisit('waiting', 'MEDIUM');
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:45:00', 'Asia/Manila'));
        $this->getJson('/api/nurse/sync')->assertOk();
        $this->assertSame('waiting', $high->fresh()->status);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/nurse/queue/call-next')
            ->assertOk()->assertJsonPath('data.id', $high->id);
        $this->assertSame(3, \App\Models\AppointmentCheckin::count());
        $this->assertSame('HIGH', $high->fresh()->triage->priority);
    }

    public function test_only_still_skipped_entries_expire_and_no_notifications_are_added()
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:00:00', 'Asia/Manila'));
        $this->actingAs($this->person(), 'api');
        $waiting = $this->queueVisit();
        $serving = $this->queueVisit('serving');
        $completed = $this->queueVisit('completed');
        $returned = $this->queueVisit('called');
        $this->queueMutation($returned, 'skip')->assertOk();
        $this->queueMutation($returned, 'returned')->assertOk();
        $returned->refresh();
        $absent = $this->queueVisit('called');
        $this->queueMutation($absent, 'skip')->assertOk();
        $notifications = \App\Models\Notification::count();
        Carbon::setTestNow(Carbon::parse('2026-10-13 09:00:00', 'Asia/Manila'));
        $this->artisan('queue:expire-skipped')->expectsOutput('Marked 1 skipped visit(s) no-show.')->assertExitCode(0);
        foreach ([$waiting, $serving, $completed, $returned] as $checkin) {
            $this->assertSame($checkin->status, $checkin->fresh()->status);
            $this->assertFalse($checkin->fresh()->appointment->no_show);
        }
        $this->assertSame('no_show', $absent->fresh()->status);
        $this->assertSame(0, app(\App\Services\SkippedQueueExpiry::class)->run());
        $this->assertSame($notifications, \App\Models\Notification::count());
    }

    public function test_late_return_is_rejected_and_reconciliation_survives_the_conflict()
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:29:59', 'Asia/Manila'));
        $this->actingAs($this->person(), 'api');
        $checkin = $this->queueVisit('called');
        $this->queueMutation($checkin, 'skip')->assertOk();
        $version = $checkin->fresh()->sync_version;
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:30:00', 'Asia/Manila'));
        $this->queueMutation($checkin, 'returned', $version)->assertStatus(409);
        $this->assertSame('no_show', $checkin->fresh()->status);
        $this->assertTrue($checkin->fresh()->appointment->no_show);
    }

    public function test_explicit_skip_after_deadline_can_mark_absent_patient_no_show()
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:45:00', 'Asia/Manila'));
        $this->actingAs($this->person(), 'api');
        $checkin = $this->queueVisit('called');
        $this->getJson('/api/nurse/sync')->assertOk();
        $this->assertSame('called', $checkin->fresh()->status);
        $this->queueMutation($checkin, 'skip')->assertOk()->assertJsonPath('data.status', 'no_show');
        $this->assertNotNull($checkin->fresh()->skipped_at);
    }

    public function test_two_devices_stale_actions_and_retries_cannot_overwrite_queue_transitions()
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:00:00', 'Asia/Manila'));
        $this->actingAs($this->person(), 'api')->withToken('device-a');
        $checkin = $this->queueVisit('called');
        $calledVersion = $checkin->fresh()->sync_version;
        $key = (string) Str::uuid();
        $before = \App\Services\NurseSync::revisions()['queue'];
        $this->queueMutation($checkin, 'skip', $calledVersion, $key)->assertOk();
        $this->queueMutation($checkin, 'skip', $calledVersion, $key)->assertOk();
        $this->assertGreaterThan($before, \App\Services\NurseSync::revisions()['queue']);
        $this->withToken('device-b');
        $this->queueMutation($checkin, 'arrived', $calledVersion)->assertStatus(409);
        $skippedVersion = $checkin->fresh()->sync_version;
        $this->queueMutation($checkin, 'returned', $skippedVersion)->assertOk();
        $this->withToken('device-a');
        $this->queueMutation($checkin, 'returned', $skippedVersion)->assertStatus(409);
        $this->queueMutation($checkin, 'skip', $calledVersion)->assertStatus(409);
        $this->assertSame('waiting', $checkin->fresh()->status);
        $this->assertSame(1, \App\Models\AppointmentCheckin::count());
    }

    public function test_skip_respects_other_device_visit_claim_and_requires_a_version()
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:00:00', 'Asia/Manila'));
        $this->actingAs($this->person(), 'api')->withToken('device-a');
        $checkin = $this->queueVisit('called');
        $this->postJson('/api/nurse/queue/' . $checkin->id . '/claim')->assertOk();
        $this->withToken('device-b');
        $this->postJson('/api/nurse/queue/' . $checkin->id . '/skip')->assertStatus(428);
        $this->queueMutation($checkin, 'skip')->assertStatus(409);
        $this->assertSame('called', $checkin->fresh()->status);
    }

    public function test_reconciliation_does_not_overwrite_a_return_committed_after_candidate_selection()
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:29:59', 'Asia/Manila'));
        $this->actingAs($this->person(), 'api')->withToken('device-a');
        $checkin = $this->queueVisit('called');
        $this->queueMutation($checkin, 'skip')->assertOk();
        $returned = false;
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:30:00', 'Asia/Manila'));
        DB::listen(function ($query) use ($checkin, &$returned) {
            if ($returned || strpos($query->sql, '"status" = ?') === false ||
                !in_array('skipped', $query->bindings, true) || strpos($query->sql, 'select *') !== 0) return;
            // Simulate another device's return commit before the reconciler
            // obtains the clinic mutex. This is a deterministic interleaving.
            $returned = true;
            Carbon::setTestNow(Carbon::parse('2026-10-12 08:29:59', 'Asia/Manila'));
            $this->withToken('device-b');
            $this->queueMutation($checkin, 'returned')->assertOk();
            Carbon::setTestNow(Carbon::parse('2026-10-12 08:30:00', 'Asia/Manila'));
        });
        $this->assertSame(0, app(\App\Services\SkippedQueueExpiry::class)->run());
        $this->assertTrue($returned);
        $this->assertSame('waiting', $checkin->fresh()->status);
        $this->assertFalse($checkin->fresh()->appointment->no_show);
    }

    public function test_skip_audit_migration_reapplication_preserves_existing_rows()
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 08:00:00', 'Asia/Manila'));
        $this->actingAs($this->person(), 'api');
        $checkin = $this->queueVisit('called');
        $this->queueMutation($checkin, 'skip')->assertOk();
        $before = $checkin->fresh()->getRawOriginal();
        $migration = require database_path('migrations/2026_10_12_000001_add_skipped_queue_audit_fields.php');
        $migration->up();
        $migration->down();
        $migration->up();
        $this->assertSame($before, $checkin->fresh()->getRawOriginal());
        $this->assertSame(1, \App\Models\AppointmentCheckin::count());
    }

    public function test_two_devices_cannot_call_conflicting_patients()
    {
        $nurse = $this->person();
        $student1 = $this->person('student');
        $student2 = $this->person('student');
        $appointment1 = \App\Models\Appointment::create([
            'user_id' => $student1->id, 'service' => 'Checkup',
            'appointment_date' => today()->toDateString(), 'time_slot' => '8:00 AM', 'status' => 'approved'
        ]);
        $appointment2 = \App\Models\Appointment::create([
            'user_id' => $student2->id, 'service' => 'Checkup',
            'appointment_date' => today()->toDateString(), 'time_slot' => '8:30 AM', 'status' => 'approved'
        ]);
        $checkin1 = \App\Models\AppointmentCheckin::create([
            'appointment_id' => $appointment1->id, 'user_id' => $student1->id,
            'checked_in_at' => now(), 'check_in_time' => now(), 'status' => 'waiting', 'queue_number' => 'R-001'
        ]);
        $checkin2 = \App\Models\AppointmentCheckin::create([
            'appointment_id' => $appointment2->id, 'user_id' => $student2->id,
            'checked_in_at' => now(), 'check_in_time' => now(), 'status' => 'waiting', 'queue_number' => 'R-002'
        ]);

        $token1 = \Tymon\JWTAuth\Facades\JWTAuth::fromUser($nurse);
        $token2 = \Tymon\JWTAuth\Facades\JWTAuth::fromUser($nurse);

        $this->actingAs($nurse, 'api')->withToken($token1);
        $this->withHeader('Idempotency-Key', (string) \Illuminate\Support\Str::uuid())
            ->postJson('/api/nurse/queue/call-next')
            ->assertOk()
            ->assertJsonPath('data.status', 'called');

        // Second device tries to call next while first patient is still called
        $this->withToken($token2)
            ->withHeader('Idempotency-Key', (string) \Illuminate\Support\Str::uuid())
            ->postJson('/api/nurse/queue/call-next')
            ->assertStatus(409);
    }
}
