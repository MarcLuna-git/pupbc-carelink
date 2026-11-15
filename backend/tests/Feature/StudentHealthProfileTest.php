<?php

namespace Tests\Feature;

use App\Models\HealthProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class StudentHealthProfileTest extends TestCase
{
    use DatabaseTransactions;

    private function student(): User
    {
        return User::create([
            'student_id' => 'HEALTH-' . Str::random(10),
            'first_name' => 'Student', 'last_name' => 'Test',
            'email' => Str::uuid() . '@example.test',
            'password' => Hash::make('TestPassword123!'),
            'birthday' => '2002-05-15', 'role' => 'student', 'status' => null,
        ]);
    }

    private function healthData(): array
    {
        return [
            'emergency_name' => 'Peña Guardian', 'emergency_relationship' => 'Parent',
            'emergency_phone' => '+639123456789', 'consent_signature' => 'Student Test',
            'consent_date' => today()->toDateString(), 'agree_privacy' => true, 'agree_terms' => true,
            'medical_history' => ['Bronchial Asthma'], 'family_history' => ['Hypertension'],
            'allergy_details' => 'Penicillin', 'medications' => 'Prescribed medication',
            'hospitalized' => true, 'hospitalization_date' => '2020-01-15',
            'surgery' => true, 'surgery_date' => '2021-02-16',
            'had_covid' => true, 'covid_date' => '2022-03-17',
            'last_menstrual_period' => '2023-04-18',
        ];
    }

    public function test_missing_profile_can_be_created_then_edited_without_duplicates(): void
    {
        $student = $this->student();
        $this->actingAs($student, 'api')->getJson('/api/student/health-profile')
            ->assertOk()->assertJsonPath('data', null);
        $this->getJson('/api/student/health-profile/status')->assertJsonPath('data.completed', false);
        $id = $this->postJson('/api/student/health-profile', $this->healthData())
            ->assertCreated()->assertJsonPath('data.family_history', ['Hypertension'])->json('data.id');
        $this->postJson('/api/student/health-profile', $this->healthData())->assertStatus(409);
        $this->putJson('/api/student/health-profile', ['family_history' => ['Asthma', 'Diabetes Mellitus']])
            ->assertOk()->assertJsonPath('data.id', $id)
            ->assertJsonPath('data.medical_history', ['Bronchial Asthma'])
            ->assertJsonPath('data.allergy_details', 'Penicillin')
            ->assertJsonPath('data.medications', 'Prescribed medication');
        $this->getJson('/api/student/health-profile')->assertOk()
            ->assertJsonPath('data.family_history', ['Asthma', 'Diabetes Mellitus']);
        $this->putJson('/api/student/health-profile', ['family_history' => [], 'medical_history' => [], 'medications' => 'Updated'])
            ->assertOk()->assertJsonPath('data.family_history', [])->assertJsonPath('data.medications', 'Updated');
        $this->assertSame(1, HealthProfile::where('user_id', $student->id)->count());
        $this->getJson('/api/student/health-profile/status')->assertJsonPath('data.completed', true);
    }

    public function test_calendar_dates_survive_loading_and_partial_updates(): void
    {
        config(['app.timezone' => 'Asia/Manila']);
        date_default_timezone_set('Asia/Manila');
        $student = $this->student();
        $data = $this->healthData();
        $this->actingAs($student, 'api')->postJson('/api/student/health-profile', $data)->assertCreated();
        foreach (['get', 'put'] as $method) {
            $response = $method === 'get'
                ? $this->getJson('/api/student/health-profile')
                : $this->putJson('/api/student/health-profile', ['medications' => 'Updated']);
            $response->assertOk();
            foreach (['hospitalization_date', 'surgery_date', 'covid_date', 'last_menstrual_period', 'consent_date'] as $field) {
                $response->assertJsonPath('data.' . $field, $data[$field]);
                $this->assertSame($data[$field], $student->healthProfile()->first()->getRawOriginal($field));
            }
        }
    }

    public function test_incomplete_profile_can_be_loaded_and_completed_but_cannot_book_yet(): void
    {
        $student = $this->student();
        $date = today('Asia/Manila')->addDay();
        if ($date->isSunday()) $date->addDay();
        $booking = ['service' => 'Consultation', 'appointment_date' => $date->toDateString(), 'time_slot' => '9:00 AM'];
        $this->actingAs($student, 'api')->postJson('/api/student/appointments', $booking)
            ->assertUnprocessable()->assertJsonPath('message', 'Complete your health profile before booking.');
        $profile = HealthProfile::create(['user_id' => $student->id, 'family_history' => ['Asthma']]);
        $this->actingAs($student->fresh(), 'api')->getJson('/api/student/health-profile')
            ->assertOk()->assertJsonPath('data.family_history', ['Asthma']);
        $this->postJson('/api/student/appointments', $booking)
            ->assertUnprocessable()->assertJsonPath('message', 'Complete your health profile before booking.');
        $this->putJson('/api/student/health-profile', $this->healthData())
            ->assertOk()->assertJsonPath('data.id', $profile->id);
        $this->getJson('/api/student/health-profile/status')->assertJsonPath('data.completed', true);
        $this->assertSame(1, HealthProfile::where('user_id', $student->id)->count());
        // A new request authenticates a fresh user, without cached relationships.
        $this->actingAs($student->fresh(), 'api')->postJson('/api/student/appointments', $booking)
            ->assertCreated()->assertJsonPath('success', true);
        $this->assertDatabaseHas('appointments', ['user_id' => $student->id, 'status' => 'pending']);
    }

    public function test_invalid_edits_do_not_replace_saved_information(): void
    {
        $student = $this->student();
        $this->actingAs($student, 'api')->postJson('/api/student/health-profile', $this->healthData())->assertCreated();
        $this->putJson('/api/student/health-profile', [
            'agree_privacy' => false, 'emergency_phone' => '123', 'family_history' => 'Asthma',
            'number_of_children' => 31, 'age_first_pregnancy' => 0,
            'hospitalization_date' => today()->addDay()->toDateString(),
            'tobacco_amount' => str_repeat('x', 101), 'marital_status' => str_repeat('x', 51),
        ])->assertUnprocessable()->assertJsonValidationErrors([
            'agree_privacy', 'emergency_phone', 'family_history', 'number_of_children',
            'age_first_pregnancy', 'hospitalization_date', 'tobacco_amount', 'marital_status',
        ]);
        $this->getJson('/api/student/health-profile')->assertOk()
            ->assertJsonPath('data.family_history', ['Hypertension'])->assertJsonPath('data.agree_privacy', true);
        $other = $this->student();
        $this->actingAs($other, 'api')->getJson('/api/student/health-profile')->assertJsonPath('data', null);
        $this->putJson('/api/student/health-profile', $this->healthData())->assertNotFound();
    }

    public function test_emergency_name_uses_registration_name_rule_on_create_and_update(): void
    {
        $student = $this->student();
        $this->actingAs($student, 'api');
        foreach (['Juan2', 'Juan@', 'O’Brien', 123] as $name) {
            $this->postJson('/api/student/health-profile', array_merge($this->healthData(), ['emergency_name' => $name]))
                ->assertUnprocessable()->assertJsonPath('errors.emergency_name.0', 'Enter a valid name.');
        }
        $this->assertSame(0, HealthProfile::where('user_id', $student->id)->count());

        $this->postJson('/api/student/health-profile', array_merge($this->healthData(), ['emergency_name' => 'Juan Dela Cruz']))
            ->assertCreated()->assertJsonPath('data.emergency_name', 'Juan Dela Cruz');
        foreach (['Peña', 'José', "O'Brien", 'Anne-Marie', 'Jr.'] as $name) {
            $this->putJson('/api/student/health-profile', ['emergency_name' => $name])
                ->assertOk()->assertJsonPath('data.emergency_name', $name);
        }
        foreach (['Juan2', 'Juan@', 'O’Brien', 123] as $name) {
            $this->putJson('/api/student/health-profile', ['emergency_name' => $name])
                ->assertUnprocessable()->assertJsonPath('errors.emergency_name.0', 'Enter a valid name.');
        }
        $this->assertSame('Jr.', $student->healthProfile()->first()->emergency_name);
    }

    public function test_emergency_phone_accepts_both_philippine_formats_without_rewriting(): void
    {
        $student = $this->student();
        $this->actingAs($student, 'api');
        $this->postJson('/api/student/health-profile', array_merge($this->healthData(), ['emergency_phone' => '+639123456789']))
            ->assertCreated()->assertJsonPath('data.emergency_phone', '+639123456789');
        $this->putJson('/api/student/health-profile', ['emergency_phone' => '+639123456789'])
            ->assertOk()->assertJsonPath('data.emergency_phone', '+639123456789');
        $this->putJson('/api/student/health-profile', ['emergency_phone' => '+639123456789'])
            ->assertOk()->assertJsonPath('data.emergency_phone', '+639123456789');
        $this->putJson('/api/student/health-profile', ['medications' => 'Updated'])
            ->assertOk()->assertJsonPath('data.emergency_phone', '+639123456789');
        $this->assertSame('+639123456789', $student->healthProfile()->first()->emergency_phone);

        $other = $this->student();
        $this->actingAs($other, 'api')->postJson('/api/student/health-profile', $this->healthData())
            ->assertCreated()->assertJsonPath('data.emergency_phone', '+639123456789');
    }

    public function test_invalid_emergency_phone_has_the_same_message_on_create_and_update(): void
    {
        $student = $this->student();
        $this->actingAs($student, 'api');
        foreach (['639123456789', '0912345678', '+63912345678', '08123456789', '0912345678a'] as $phone) {
            $this->postJson('/api/student/health-profile', array_merge($this->healthData(), ['emergency_phone' => $phone]))
                ->assertUnprocessable()->assertJsonPath('errors.emergency_phone.0', 'Use +639XXXXXXXXX.');
        }
        $this->assertSame(0, HealthProfile::where('user_id', $student->id)->count());

        $this->postJson('/api/student/health-profile', $this->healthData())->assertCreated();
        foreach (['639123456789', '0912345678', '+63912345678', '08123456789', '0912345678a'] as $phone) {
            $this->putJson('/api/student/health-profile', ['emergency_phone' => $phone])
                ->assertUnprocessable()->assertJsonPath('errors.emergency_phone.0', 'Use +639XXXXXXXXX.');
        }
        $this->assertSame('+639123456789', $student->healthProfile()->first()->emergency_phone);
    }

    public function test_emergency_phone_cannot_match_either_stored_student_mobile(): void
    {
        $student = $this->student();
        $student->update(['mobile_number' => '+639171234567']);
        $student->profile()->create(['mobile_number' => '+639987654321']);
        $this->actingAs($student, 'api');
        $message = 'Emergency contact number must be different from your mobile number.';

        foreach (['+639171234567', '+639987654321'] as $phone) {
            $this->postJson('/api/student/health-profile', array_merge($this->healthData(), ['emergency_phone' => $phone]))
                ->assertUnprocessable()->assertJsonPath('errors.emergency_phone.0', $message);
        }
        $this->assertSame(0, HealthProfile::where('user_id', $student->id)->count());

        $this->postJson('/api/student/health-profile', $this->healthData())->assertCreated();
        foreach (['+639171234567', '+639987654321'] as $phone) {
            $this->putJson('/api/student/health-profile', ['emergency_phone' => $phone])
                ->assertUnprocessable()->assertJsonPath('errors.emergency_phone.0', $message);
        }
        $student->update(['mobile_number' => '639171234567']);
        $this->putJson('/api/student/health-profile', ['emergency_phone' => '+639171234567'])
            ->assertUnprocessable()->assertJsonPath('errors.emergency_phone.0', $message);
        $this->assertSame('+639123456789', $student->healthProfile()->first()->emergency_phone);
    }

    public function test_signature_must_match_registered_name_before_create_or_update_writes(): void
    {
        $student = $this->student();
        $this->actingAs($student, 'api');
        $message = 'Signature must match your registered name.';

        $this->postJson('/api/student/health-profile', array_merge($this->healthData(), ['consent_signature' => 'Other Student']))
            ->assertUnprocessable()->assertJsonPath('errors.consent_signature.0', $message);
        $this->assertSame(0, HealthProfile::where('user_id', $student->id)->count());

        $this->postJson('/api/student/health-profile', $this->healthData())->assertCreated();
        $this->putJson('/api/student/health-profile', ['consent_signature' => 'Other Student', 'medications' => 'Should not save'])
            ->assertUnprocessable()->assertJsonPath('errors.consent_signature.0', $message);
        $profile = $student->healthProfile()->first();
        $this->assertSame('Student Test', $profile->consent_signature);
        $this->assertSame('Prescribed medication', $profile->medications);

        $student->update(['first_name' => 'Renamed']);
        $this->putJson('/api/student/health-profile', ['medications' => 'Updated without signature'])
            ->assertOk()->assertJsonPath('data.consent_signature', 'Student Test');
        $this->putJson('/api/student/health-profile', ['consent_signature' => 'Student Test', 'medications' => 'Should not save'])
            ->assertUnprocessable()->assertJsonPath('errors.consent_signature.0', $message);
        $profile = $student->healthProfile()->first();
        $this->assertSame('Student Test', $profile->consent_signature);
        $this->assertSame('Updated without signature', $profile->medications);
    }

    public function test_signature_accepts_first_last_or_full_middle_name_ignoring_case_and_extra_spaces(): void
    {
        $student = $this->student();
        $student->update(['middle_name' => 'Peña']);
        $this->actingAs($student, 'api');

        $this->postJson('/api/student/health-profile', array_merge($this->healthData(), ['consent_signature' => '  sTuDeNt   tEsT  ']))
            ->assertCreated()->assertJsonPath('data.consent_signature', 'sTuDeNt   tEsT');
        $this->putJson('/api/student/health-profile', ['consent_signature' => 'STUDENT   PEÑA   TEST'])
            ->assertOk()->assertJsonPath('data.consent_signature', 'STUDENT   PEÑA   TEST');
        $this->assertSame('STUDENT   PEÑA   TEST', $student->healthProfile()->first()->consent_signature);
    }
}
