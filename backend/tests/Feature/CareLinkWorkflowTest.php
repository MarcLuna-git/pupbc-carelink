<?php
namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use App\Models\{User, Appointment, AppointmentCheckin, Consultation, HealthProfile, PasswordReset, PendingRegistration, Announcement, EmergencyEncounter, Medicine, MedicineBatch, MedicineStockMovement};
use App\Services\AuthService;

class CareLinkWorkflowTest extends TestCase
{
    use DatabaseTransactions;
    protected function setUp(): void
    {
        parent::setUp();
        // Check-in is open from 15 minutes before to 30 minutes after the 4:30 PM slot
        // used below, so pin the clock inside that window or these tests only pass
        // when run between 4:15 and 5:00 PM Manila. Laravel resets it in tearDown.
        \Carbon\Carbon::setTestNow(\Carbon\Carbon::now('Asia/Manila')->setTime(16, 30));
    }
    private function person($role = 'student')
    {
        return User::create(['student_id' => 'TEST-' . Str::random(10), 'first_name' => 'Test', 'last_name' => 'Patient', 'email' => Str::uuid() . '@example.test', 'password' => Hash::make('TestPassword123!'), 'birthday' => '2002-05-15', 'role' => $role, 'status' => null]);
    }
    private function healthData()
    {
        return ['emergency_name' => 'Test Guardian', 'emergency_relationship' => 'Parent', 'emergency_phone' => '+639123456789', 'consent_signature' => 'Test Patient', 'consent_date' => today()->toDateString(), 'agree_privacy' => true, 'agree_terms' => true, 'medical_history' => [], 'family_history' => []];
    }
    private function appointment($student, $status = 'approved', $date = null)
    {
        return Appointment::create(['user_id' => $student->id, 'service' => 'General Checkup', 'appointment_date' => $date ?: today()->toDateString(), 'time_slot' => '4:30 PM', 'status' => $status]);
    }
    private function kiosk($student, $extra = [])
    {
        return $this->withHeader('X-Kiosk-Token', config('kiosk.device_token'))->postJson('/api/kiosk/checkin', array_merge(['student_id' => $student->student_id, 'method' => 'manual', 'chief_complaint' => 'Mild headache', 'severity' => 'mild', 'red_flags' => ['none']], $extra));
    }
    private function visit($student = null)
    {
        $student = $student ?: $this->person();
        $appointment = $this->appointment($student);
        $response = $this->kiosk($student)->assertCreated();
        return [$student, $appointment, AppointmentCheckin::findOrFail($response->json('data.id'))];
    }
    private function payload($student, $appointment, $checkin)
    {
        return ['user_id' => $student->id, 'appointment_id' => $appointment->id, 'appointment_checkin_id' => $checkin->id, 'chief_complaint' => 'Headache', 'history_present_illness' => 'Since this morning', 'nursing_assessment' => 'Alert and oriented', 'nursing_interventions' => 'Advised rest', 'vital_signs' => ['bp' => '120/80', 'temp' => '36.5'], 'follow_up_required' => true, 'follow_up_date' => \Carbon\Carbon::tomorrow()->toDateString()];
    }
    public function test_student_and_nurse_role_denial()
    {
        $this->actingAs($this->person(), 'api')->getJson('/api/nurse/students')->assertForbidden();
        $this->actingAs($this->person('nurse'), 'api')->getJson('/api/student/profile')->assertForbidden();
    }
    public function test_blank_jwt_configuration_fails_closed()
    {
        config(['jwt.secret' => '']);
        $this->postJson('/api/auth/login', [])->assertStatus(503);
        $this->getJson('/api/student/profile')->assertStatus(503);
    }
    public function test_registration_stores_only_hash_and_verifies_otp()
    {
        Mail::fake();
        $data = ['student_id' => 'NEW-' . Str::random(10), 'first_name' => 'Test', 'last_name' => 'Registration', 'email' => Str::uuid() . '@example.test', 'password' => 'SecurePassword123!', 'birthday' => '2002-05-15'];
        app(AuthService::class)->requestRegistrationOtp($data);
        $pending = PendingRegistration::where('email', $data['email'])->firstOrFail();
        $this->assertArrayNotHasKey('password', $pending->payload);
        $this->assertArrayNotHasKey('password_confirmation', $pending->payload);
        $this->assertTrue(Hash::check($data['password'], $pending->payload['password_hash']));
        $pending->update(['otp_hash' => Hash::make('123456')]);
        $user = app(AuthService::class)->verifyRegistration($data['email'], '123456')['user'];
        $this->assertTrue(Hash::check($data['password'], $user->password));
        $this->assertDatabaseMissing('pending_registrations', ['email' => $data['email']]);
    }
    public function test_password_reset_storage_hash_expiry_and_single_use()
    {
        Mail::fake(); $user = $this->person();
        app(AuthService::class)->forgotPassword(['email' => $user->email, 'account_type' => 'student']);
        $reset = PasswordReset::where('user_id', $user->id)->firstOrFail();
        $this->assertNotEmpty($reset->otp_hash);
        $reset->update(['otp_hash' => Hash::make('123456')]);
        $data = ['email' => $user->email, 'account_type' => 'student', 'otp' => '123456', 'password' => 'NewPassword123!', 'password_confirmation' => 'NewPassword123!'];
        $this->postJson('/api/auth/reset-password', array_merge($data, ['otp' => '000000']))->assertStatus(400);
        $this->postJson('/api/auth/reset-password', $data)->assertOk();
        $this->assertTrue(Hash::check('NewPassword123!', $user->fresh()->password));
        $this->postJson('/api/auth/reset-password', $data)->assertStatus(400);
        $reset->update(['is_used' => false, 'expires_at' => now()->subMinute()]);
        $this->postJson('/api/auth/reset-password', $data)->assertStatus(400);
    }
    public function test_nurse_settings_are_role_protected_and_password_verified()
    {
        $nurse = $this->person('nurse');
        $this->actingAs($this->person(), 'api')->putJson('/api/nurse/profile', ['first_name' => 'No', 'last_name' => 'Access'])->assertForbidden();
        $this->actingAs($nurse, 'api')->putJson('/api/nurse/profile', ['first_name' => 'Updated', 'last_name' => 'Nurse', 'role' => 'student'], ['If-Match' => $nurse->fresh()->sync_version])->assertOk();
        $this->assertSame('nurse', $nurse->fresh()->role);
        $this->postJson('/api/nurse/change-password', ['current_password' => 'wrong', 'new_password' => 'ChangedPass123!', 'new_password_confirmation' => 'ChangedPass123!'])->assertStatus(400);
        $this->postJson('/api/nurse/change-password', ['current_password' => 'TestPassword123!', 'new_password' => 'ChangedPass123!', 'new_password_confirmation' => 'ChangedPass123!'])->assertOk();
        $this->assertTrue(Hash::check('ChangedPass123!', $nurse->fresh()->password));
    }
    public function test_health_profile_requires_contact_consent_and_normal_arrays()
    {
        $student = $this->person(); $this->actingAs($student, 'api');
        $this->postJson('/api/student/health-profile', [])->assertUnprocessable();
        $this->postJson('/api/student/health-profile', array_merge($this->healthData(), ['medical_history' => ['Bronchial Asthma']]))->assertCreated();
        $profile = HealthProfile::where('user_id', $student->id)->firstOrFail();
        $this->assertSame(['Bronchial Asthma'], json_decode($profile->getRawOriginal('medical_history'), true));
        $this->getJson('/api/student/health-profile/status')->assertJsonPath('data.completed', true);
        $this->putJson('/api/student/health-profile', ['agree_privacy' => false])->assertUnprocessable();
        $this->putJson('/api/student/health-profile', ['medications' => 'Updated'])->assertOk();
    }
    public function test_incomplete_existing_health_profile_does_not_allow_booking()
    {
        $student = $this->person(); HealthProfile::create(['user_id' => $student->id]);
        $this->actingAs($student, 'api')->getJson('/api/student/health-profile/status')->assertJsonPath('data.completed', false);
        $this->postJson('/api/student/appointments', ['service' => 'General Checkup', 'appointment_date' => \Carbon\Carbon::tomorrow()->toDateString(), 'time_slot' => '9:00 AM'])->assertUnprocessable();
    }
    public function test_legacy_double_encoded_arrays_are_read_without_data_loss()
    {
        $profile = HealthProfile::create(array_merge($this->healthData(), ['user_id' => $this->person()->id]));
        DB::table('health_profiles')->where('id', $profile->id)->update(['medical_history' => json_encode(json_encode(['Bronchial Asthma']))]);
        $this->assertSame(['Bronchial Asthma'], $profile->fresh()->medical_history);
    }
    public function test_device_authorization_and_validation()
    {
        $this->postJson('/api/kiosk/lookup', [])->assertForbidden();
        $this->withHeader('X-Kiosk-Token', config('kiosk.device_token'))->postJson('/api/kiosk/lookup', [])->assertUnprocessable();
    }
    public function test_only_approved_today_is_eligible()
    {
        foreach (['pending', 'rejected', 'cancelled', 'completed'] as $status) {
            $student = $this->person(); $this->appointment($student, $status);
            $this->kiosk($student)->assertUnprocessable();
            $this->assertSame(0, AppointmentCheckin::where('user_id', $student->id)->count());
        }
        foreach ([\Carbon\Carbon::yesterday()->toDateString(), \Carbon\Carbon::tomorrow()->toDateString()] as $date) {
            $student = $this->person(); $this->appointment($student, 'approved', $date);
            $this->kiosk($student)->assertUnprocessable();
        }
        $this->kiosk($this->person())->assertUnprocessable();
        $this->visit();
    }
    public function test_duplicate_checkin_is_idempotent_and_queue_response_is_minimal()
    {
        [$student, $appointment, $checkin] = $this->visit();
        $this->kiosk($student)->assertOk()->assertJsonPath('data.id', $checkin->id);
        $this->assertSame(1, AppointmentCheckin::where('appointment_id', $appointment->id)->count());
        $data = $this->getJson('/api/kiosk/queue')->assertOk()->json('data.queue.0');
        foreach (['user','user_id','appointment','triage','chief_complaint','notes'] as $key) $this->assertArrayNotHasKey($key, $data);
    }
    public function test_queue_order_and_allocation_include_historical_gaps()
    {
        [$low, $a, $old] = $this->visit(); $old->update(['queue_number' => 'R-009', 'check_in_time' => now()->subMinutes(5)]);
        $medium = $this->person(); $this->appointment($medium); $m = $this->kiosk($medium, ['severity' => 'moderate'])->assertCreated();
        $this->assertSame('R-010', $m->json('data.queue_number'));
        $high = $this->person(); $this->appointment($high); $h = $this->kiosk($high, ['severity' => 'severe'])->assertCreated();
        $queue = $this->getJson('/api/kiosk/queue')->assertOk()->json('data.queue');
        $this->assertSame(['HIGH','MEDIUM','LOW'], array_column($queue, 'priority'));
        $this->assertCount(3, array_unique(array_column($queue, 'queue_number')));
        $nurse = $this->person('nurse');
        $list = $this->actingAs($nurse, 'api')->getJson('/api/nurse/queue/checkins')->assertOk()->json('data');
        $this->assertSame(array_column($queue, 'id'), array_column($list, 'id'));
    }
    public function test_same_priority_uses_earlier_arrival()
    {
        [, , $first] = $this->visit(); $first->update(['check_in_time' => now()->subMinutes(2)]);
        [, , $second] = $this->visit();
        $ids = array_column($this->getJson('/api/kiosk/queue')->json('data.queue'), 'id');
        $this->assertSame([$first->id, $second->id], $ids);
    }
    public function test_history_only_modifies_relevant_complaints()
    {
        foreach ([['mild headache','LOW'], ['wheezing','MEDIUM']] as [$complaint,$priority]) {
            $student = $this->person(); HealthProfile::create(array_merge($this->healthData(), ['user_id'=>$student->id, 'medical_history'=>['Bronchial Asthma'], 'allergy_details'=>'Pollen']));
            $this->appointment($student); $this->kiosk($student, ['chief_complaint'=>$complaint])->assertJsonPath('data.priority',$priority);
        }
    }
    public function test_qr_student_hash_ownership_and_legacy_eligibility()
    {
        $one=$this->person(); $two=$this->person(); $this->appointment($one);
        $one->qrCode()->create(['qr_code_hash'=>'test-active-qr-one','is_active'=>true]);
        $two->qrCode()->create(['qr_code_hash'=>'test-active-qr-two','is_active'=>true]);
        $this->withHeader('X-Kiosk-Token',config('kiosk.device_token'));
        $this->postJson('/api/kiosk/lookup',['method'=>'qr','student_id'=>$one->student_id,'qr_hash'=>'test-active-qr-two'])->assertUnprocessable();
        $this->postJson('/api/kiosk/lookup',['method'=>'qr','student_id'=>$one->student_id])->assertUnprocessable();
        $this->postJson('/api/kiosk/lookup',['method'=>'qr','student_id'=>$one->student_id,'qr_hash'=>'test-active-qr-one'])->assertOk();
        $this->postJson('/api/kiosk/verify-qr',['student_id'=>$one->student_id,'qr_hash'=>'test-active-qr-one'])->assertOk();
        $one->qrCode->update(['is_active'=>false]);
        $this->postJson('/api/kiosk/verify-qr',['student_id'=>$one->student_id,'qr_hash'=>'test-active-qr-one'])->assertUnprocessable();
        $this->assertSame(0, AppointmentCheckin::count());
    }
    public function test_call_next_requires_consultation_completion()
    {
        [$student,$appointment,$checkin]=$this->visit();
        // The clock is frozen, so give the first patient an earlier arrival to make the call order certain.
        $checkin->update(['check_in_time'=>now()->subMinutes(2)]);
        $this->visit();
        $this->actingAs($this->person('nurse'),'api')->postJson('/api/nurse/queue/call-next')->assertOk()
            ->assertJsonPath('data.id',$checkin->id);
        // Calling now only marks the patient "called"; a second call is blocked until they are handled.
        $this->postJson('/api/nurse/queue/call-next')->assertStatus(409);
        $this->assertSame(1,AppointmentCheckin::where('status','called')->count());
        $this->postJson('/api/nurse/queue/'.$checkin->id.'/arrived')->assertOk();
        $this->postJson('/api/nurse/queue/call-next')->assertStatus(409);
        $this->assertSame(1,AppointmentCheckin::where('status','serving')->count());
        $this->assertSame(0,AppointmentCheckin::where('status','completed')->count());
        $this->patchJson('/api/nurse/appointments/'.$appointment->id.'/complete')->assertUnprocessable();
    }
    public function test_consultation_ownership_duplicate_and_history_linkage()
    {
        [$student,$appointment,$checkin]=$this->visit();
        $other=$this->person(); $otherAppointment=$this->appointment($other);
        $nurse=$this->person('nurse'); $this->actingAs($nurse,'api');
        $data=$this->payload($student,$appointment,$checkin);
        $this->postJson('/api/nurse/consultations',$data)->assertUnprocessable();
        $this->postJson('/api/nurse/queue/call-next')->assertOk();
        $this->postJson('/api/nurse/consultations',array_merge($data,['user_id'=>$other->id]))->assertUnprocessable();
        $this->postJson('/api/nurse/consultations',array_merge($data,['appointment_id'=>$otherAppointment->id]))->assertUnprocessable();
        $this->postJson('/api/nurse/consultations',$data)->assertCreated()->assertJsonPath('data.vital_signs.bp','120/80')->assertJsonPath('data.follow_up_required',true);
        $this->postJson('/api/nurse/consultations',$data)->assertStatus(409);
        $this->assertSame('completed',$checkin->fresh()->status);
        $this->assertSame('completed',$appointment->fresh()->status);
        $history=$this->getJson('/api/nurse/students/'.$student->id.'/clinic-history')->assertOk();
        $history->assertJsonPath('data.0.checkin.id',$checkin->id)->assertJsonPath('data.0.appointment.id',$appointment->id)->assertJsonPath('data.0.triage.priority','LOW');
        // The nurse sees the clinical notes they entered; the student's own history does not carry them.
        $history->assertJsonPath('data.0.history_present_illness','Since this morning')
            ->assertJsonPath('data.0.nursing_assessment','Alert and oriented')
            ->assertJsonPath('data.0.nursing_interventions','Advised rest')
            ->assertJsonPath('data.0.vital_signs.bp','120/80');
        $this->actingAs($student,'api')->getJson('/api/student/clinic-history')->assertJsonCount(1,'data');
        $studentRecord=$this->getJson('/api/student/clinic-history')->json('data.0');
        foreach(['history_present_illness','nursing_assessment','nursing_interventions','treatment_plan'] as $note) $this->assertArrayNotHasKey($note,$studentRecord);
    }
    public function test_emergency_nurse_only_correct_student_and_incident_chronology()
    {
        $student=$this->person(); $nurse=$this->person('nurse');
        $data=['student_id'=>$student->id,'incident_datetime'=>\Carbon\Carbon::yesterday()->toDateTimeString(),'reason'=>'Emergency test','notes'=>'Internal note'];
        $this->actingAs($student,'api')->postJson('/api/nurse/emergency-encounters',$data)->assertForbidden();
        $this->actingAs($nurse,'api')->postJson('/api/nurse/emergency-encounters',array_merge($data,['student_id'=>$nurse->id]))->assertNotFound();
        $this->postJson('/api/nurse/emergency-encounters',$data)->assertCreated();
        $this->postJson('/api/nurse/emergency-encounters',array_merge($data,['incident_datetime'=>now()->subHour()->toDateTimeString(),'reason'=>'More recent']))->assertCreated();
        $this->assertSame(0,Appointment::count()); $this->assertSame(0,AppointmentCheckin::count());
        $this->actingAs($student,'api')->getJson('/api/student/clinic-history')->assertJsonPath('data.0.reason','More recent')->assertJsonCount(2,'data');
        $this->assertArrayNotHasKey('notes',$this->getJson('/api/student/clinic-history')->json('data.0'));
        $other=$this->person(); $this->actingAs($other,'api')->getJson('/api/student/clinic-history')->assertJsonCount(0,'data');
    }
    public function test_incomplete_consultations_are_not_completed_history()
    {
        $student=$this->person(); $nurse=$this->person('nurse');
        Consultation::create(['user_id'=>$student->id,'nurse_id'=>$nurse->id,'status'=>'in_progress']);
        $this->actingAs($student,'api')->getJson('/api/student/clinic-history')->assertJsonCount(0,'data');
    }
    public function test_announcement_visibility_for_students_public_and_nurses()
    {
        $nurse=$this->person('nurse'); $rows=[];
        foreach ([['all',true],['students',true],['nurses',true],['all',false]] as [$audience,$published]) $rows[]=Announcement::create(['title'=>'Test','content'=>'Content','created_by'=>$nurse->id,'target_audience'=>$audience,'is_published'=>$published,'published_at'=>now()]);
        $this->getJson('/api/announcements')->assertJsonCount(2,'data.data');
        $this->getJson('/api/announcements/'.$rows[2]->id)->assertNotFound();
        $this->actingAs($this->person(),'api')->getJson('/api/announcements')->assertJsonCount(2,'data.data');
        $this->getJson('/api/announcements/'.$rows[3]->id)->assertNotFound();
        $this->actingAs($nurse,'api')->getJson('/api/nurse/announcements')->assertJsonCount(4,'data.data');
    }
    public function test_cancellation_removes_waiting_queue_but_rejects_serving_visit()
    {
        [$student,$appointment,$checkin]=$this->visit();
        $this->actingAs($student,'api')->patchJson('/api/student/appointments/'.$appointment->id.'/cancel')->assertOk();
        $this->assertSame('no_show',$checkin->fresh()->status);
        [$student2,$appointment2,$checkin2]=$this->visit();
        $nurse=$this->person('nurse');
        $this->actingAs($nurse,'api')->postJson('/api/nurse/queue/call-next')->assertOk();
        // Called but not yet arrived: cancelling would strand the "called" check-in and block the queue.
        $this->actingAs($student2,'api')->patchJson('/api/student/appointments/'.$appointment2->id.'/cancel')->assertStatus(409);
        $this->actingAs($nurse,'api')->postJson('/api/nurse/queue/'.$checkin2->id.'/arrived')->assertOk();
        $this->actingAs($student2,'api')->patchJson('/api/student/appointments/'.$appointment2->id.'/cancel')->assertStatus(409);
        $this->assertSame('serving',$checkin2->fresh()->status);
    }

    public function test_nurse_can_cancel_pending_or_rejected_with_reason_and_notifies_student()
    {
        $nurse = $this->person('nurse');
        $student = $this->person();
        $pending = $this->appointment($student, 'pending', \Carbon\Carbon::tomorrow()->toDateString());
        $this->actingAs($nurse, 'api')->patchJson('/api/nurse/appointments/'.$pending->id.'/cancel', ['reason' => 'Clinic schedule unavailable'])->assertOk();
        $this->assertSame('cancelled', $pending->fresh()->status);
        $this->assertSame('Clinic schedule unavailable', $pending->fresh()->cancellation_reason);
        $this->assertDatabaseHas('notifications', ['user_id' => $student->id, 'type' => 'appointment_cancelled']);

        $rejected = $this->appointment($student, 'rejected', \Carbon\Carbon::tomorrow()->addDay()->toDateString());
        $rejected->update(['rejection_reason' => 'No available slot']);
        $this->actingAs($nurse, 'api')->patchJson('/api/nurse/appointments/'.$rejected->id.'/cancel', ['reason' => 'Student request'])->assertOk();
        $this->assertSame('cancelled', $rejected->fresh()->status);
        $this->assertSame('No available slot', $rejected->fresh()->rejection_reason);
    }

    public function test_nurse_cannot_cancel_approved_appointment_or_without_reason()
    {
        $nurse = $this->person('nurse');
        $student = $this->person();
        $appointment = $this->appointment($student, 'approved', \Carbon\Carbon::tomorrow()->toDateString());

        $this->actingAs($nurse, 'api')->patchJson('/api/nurse/appointments/'.$appointment->id.'/cancel', [])->assertUnprocessable();
        $this->actingAs($nurse, 'api')->patchJson('/api/nurse/appointments/'.$appointment->id.'/cancel', ['reason' => 'Clinic closed'])->assertUnprocessable();
        $this->assertSame('approved', $appointment->fresh()->status);
    }

    public function test_pending_appointments_expire_after_their_date_and_notify_students()
    {
        $student = $this->person();
        $appointment = $this->appointment($student, 'pending', \Carbon\Carbon::yesterday()->toDateString());

        $this->artisan('appointments:expire')->assertExitCode(0);

        $this->assertSame('expired', $appointment->fresh()->status);
        $this->assertDatabaseHas('notifications', ['user_id' => $student->id, 'type' => 'appointment_expired']);
    }

    public function test_nurse_student_status_filter_treats_normal_and_pending_as_active()
    {
        $nurse = $this->person('nurse');
        $normal = $this->person();
        $pending = $this->person();
        $inactive = $this->person();
        $archived = $this->person();
        $pendingNurse = $this->person('nurse');
        foreach ([$normal, $pending, $inactive, $archived, $pendingNurse] as $user) {
            $user->update(['last_name' => 'SCRUM356']);
        }
        $pending->update(['status' => 'pending']);
        $inactive->update(['status' => 'inactive']);
        $archived->update(['status' => 'archived']);
        $archived->delete();
        $pendingNurse->update(['status' => 'pending']);

        $this->actingAs($nurse, 'api');
        $ids = fn($status) => array_column($this->getJson('/api/nurse/students?search=SCRUM356&status='.$status)
            ->assertOk()->json('data.data'), 'id');

        $this->assertEqualsCanonicalizing([$normal->id, $pending->id], $ids('active'));
        $this->assertEqualsCanonicalizing([$archived->id], $ids('archived'));
        $this->assertEqualsCanonicalizing([$inactive->id], $ids('inactive'));
        $this->assertEqualsCanonicalizing([$normal->id, $pending->id, $inactive->id], $ids(''));
    }

    public function test_archive_and_restore_returns_null_status()
    {
        $nurse = $this->person('nurse');
        $student = $this->person();

        $this->actingAs($nurse, 'api')->patchJson('/api/nurse/students/'.$student->id.'/archive', ['reason' => 'Student is no longer enrolled'])->assertOk();
        $this->assertSoftDeleted('users', ['id' => $student->id]);
        $this->assertSame('archived', $student->fresh()->status);
        $this->assertDatabaseHas('notifications', ['user_id' => $student->id, 'type' => 'student_archived']);

        $this->actingAs($nurse, 'api')->patchJson('/api/nurse/students/'.$student->id.'/restore')->assertOk();
        $this->assertDatabaseHas('users', ['id' => $student->id, 'status' => null, 'deleted_at' => null]);
    }

    public function test_archive_is_blocked_by_pending_and_approved_appointments_today_or_later()
    {
        Mail::fake();
        $nurse = $this->person('nurse');
        foreach (['pending', 'approved'] as $status) {
            foreach ([today('Asia/Manila')->toDateString(), today('Asia/Manila')->addDay()->toDateString()] as $date) {
                $student = $this->person();
                $appointment = $this->appointment($student, $status, $date);

                $this->actingAs($nurse, 'api')->patchJson('/api/nurse/students/'.$student->id.'/archive', ['reason' => 'Archive requested'])
                    ->assertUnprocessable()->assertJsonPath('message', 'Student cannot be archived with an upcoming appointment.');
                $this->assertNotSoftDeleted('users', ['id' => $student->id]);
                $this->assertNull($student->fresh()->status);
                $this->assertNull($student->fresh()->archive_reason);
                $this->assertSame($status, $appointment->fresh()->status);
                $this->assertSame(0, \App\Models\Notification::where('user_id', $student->id)->count());
            }
        }
        Mail::assertNothingSent();
    }

    public function test_archive_is_blocked_by_each_active_queue_status_today()
    {
        Mail::fake();
        $nurse = $this->person('nurse');
        foreach (['waiting', 'called', 'serving', 'skipped'] as $status) {
            $student = $this->person();
            $appointment = $this->appointment($student, 'completed');
            $checkin = AppointmentCheckin::create([
                'appointment_id' => $appointment->id, 'user_id' => $student->id,
                'checked_in_at' => now(), 'check_in_time' => now(), 'is_walk_in' => false, 'status' => $status,
            ]);

            $this->actingAs($nurse, 'api')->patchJson('/api/nurse/students/'.$student->id.'/archive', ['reason' => 'Archive requested'])
                ->assertUnprocessable()->assertJsonPath('message', 'Student cannot be archived with an active queue entry.');
            $this->assertNotSoftDeleted('users', ['id' => $student->id]);
            $this->assertNull($student->fresh()->status);
            $this->assertNull($student->fresh()->archive_reason);
            $this->assertSame($status, $checkin->fresh()->status);
            $this->assertSame(0, \App\Models\Notification::where('user_id', $student->id)->count());
        }
        Mail::assertNothingSent();
    }

    public function test_archive_allows_stale_and_terminal_queue_entries()
    {
        $nurse = $this->person('nurse');
        foreach (['waiting', 'called', 'serving', 'skipped', 'no_show', 'completed'] as $status) {
            $student = $this->person();
            $appointment = $this->appointment($student, 'completed', today('Asia/Manila')->subDay()->toDateString());
            $checkin = AppointmentCheckin::create([
                'appointment_id' => $appointment->id, 'user_id' => $student->id,
                'checked_in_at' => now(), 'check_in_time' => now(), 'is_walk_in' => false, 'status' => $status,
            ]);
            $checkin->forceFill(['created_at' => today('Asia/Manila')->subDay()->addHours(12)])->save();
            $this->assertSame(today('Asia/Manila')->subDay()->toDateString(), $checkin->fresh()->created_at->toDateString());

            $this->actingAs($nurse, 'api')->patchJson('/api/nurse/students/'.$student->id.'/archive', ['reason' => 'Archive requested'])->assertOk();
            $this->assertSoftDeleted('users', ['id' => $student->id]);
        }
        foreach (['no_show', 'completed'] as $status) {
            $student = $this->person();
            $appointment = $this->appointment($student, 'completed');
            AppointmentCheckin::create([
                'appointment_id' => $appointment->id, 'user_id' => $student->id,
                'checked_in_at' => now(), 'check_in_time' => now(), 'is_walk_in' => false, 'status' => $status,
            ]);

            $this->actingAs($nurse, 'api')->patchJson('/api/nurse/students/'.$student->id.'/archive', ['reason' => 'Archive requested'])->assertOk();
            $this->assertSoftDeleted('users', ['id' => $student->id]);
        }
    }

    public function test_archive_allows_past_and_terminal_appointments()
    {
        $nurse = $this->person('nurse');
        foreach (['pending', 'approved'] as $status) {
            $student = $this->person();
            $this->appointment($student, $status, today('Asia/Manila')->subDay()->toDateString());
            $this->actingAs($nurse, 'api')->patchJson('/api/nurse/students/'.$student->id.'/archive', ['reason' => 'Archive requested'])->assertOk();
            $this->assertSoftDeleted('users', ['id' => $student->id]);
        }
        foreach (['rejected', 'completed', 'cancelled', 'expired'] as $status) {
            $student = $this->person();
            $this->appointment($student, $status, today('Asia/Manila')->addDay()->toDateString());
            $this->actingAs($nurse, 'api')->patchJson('/api/nurse/students/'.$student->id.'/archive', ['reason' => 'Archive requested'])->assertOk();
            $this->assertSoftDeleted('users', ['id' => $student->id]);
        }
    }

    public function test_nurse_can_update_only_medical_history_and_medications()
    {
        $nurse = $this->person('nurse');
        $student = $this->person();
        $profile = HealthProfile::create(array_merge($this->healthData(), ['user_id' => $student->id, 'allergy_details' => 'Pollen']));

        $this->actingAs($nurse, 'api')->patchJson('/api/nurse/students/'.$student->id.'/medical-record', [
            'medical_history' => ['Asthma'],
            'medications' => 'Salbutamol',
            'allergy_details' => 'Should not change',
        ], ['If-Match' => $profile->fresh()->sync_version])->assertOk();

        $profile = $profile->fresh();
        $this->assertSame(['Asthma'], $profile->medical_history);
        $this->assertSame('Salbutamol', $profile->medications);
        $this->assertSame('Pollen', $profile->allergy_details);
    }

    public function test_completed_consultation_is_read_only()
    {
        $student = $this->person();
        $nurse = $this->person('nurse');
        $consultation = Consultation::create([
            'user_id' => $student->id,
            'nurse_id' => $nurse->id,
            'chief_complaint' => 'Headache',
            'status' => 'completed',
        ]);

        $this->actingAs($nurse, 'api')->putJson('/api/nurse/consultations/'.$consultation->id, ['chief_complaint' => 'Changed'], ['If-Match' => $consultation->fresh()->sync_version])->assertUnprocessable();
        $this->assertSame('Headache', $consultation->fresh()->chief_complaint);
    }

    public function test_medicine_batches_record_stock_movements_and_notify_nurses_when_low()
    {
        $nurse = $this->person('nurse');
        $medicine = Medicine::create(['name' => 'Test Medicine', 'quantity' => 0, 'minimum_stock' => 5, 'unit' => 'tablet', 'added_by' => $nurse->id]);
        $this->actingAs($nurse, 'api');

        $batch = $this->postJson('/api/nurse/medicines/'.$medicine->id.'/batches', [
            'lot_number' => 'LOT-001',
            'quantity' => 10,
            'expiry_date' => \Carbon\Carbon::tomorrow()->addYear()->toDateString(),
            'supplier' => 'Optional Supplier',
        ])->assertCreated()->json('data');

        $this->postJson('/api/nurse/medicines/'.$medicine->id.'/movements', [
            'movement_type' => 'dispensed',
            'quantity' => 6,
            'student_id' => $this->person('student')->student_id,
            'batch_id' => $batch['id'],
            'reason' => 'Dispensed for clinic visit',
        ], ['If-Match' => $medicine->fresh()->sync_version])->assertOk();

        $this->assertSame(4, $medicine->fresh()->quantity);
        $this->assertSame(4, MedicineBatch::findOrFail($batch['id'])->quantity);
        $this->assertSame(2, MedicineStockMovement::where('medicine_id', $medicine->id)->count());
        $this->assertDatabaseHas('notifications', ['user_id' => $nurse->id, 'type' => 'medicine_low_stock']);
    }
}
