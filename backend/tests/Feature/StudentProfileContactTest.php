<?php

namespace Tests\Feature;

use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class StudentProfileContactTest extends TestCase
{
    use DatabaseTransactions;

    private function student(): User
    {
        return User::create([
            'first_name' => 'Contact', 'last_name' => 'Test',
            'student_id' => 'CONTACT-' . Str::random(12),
            'email' => Str::uuid() . '@example.test',
            'password' => Hash::make('TestPassword123!'), 'role' => 'student',
        ]);
    }

    public function test_optional_guardian_contact_can_be_omitted_or_cleared(): void
    {
        $student = $this->student();
        $profile = StudentProfile::create(['user_id' => $student->id, 'guardian_contact' => '09123456789']);
        $this->actingAs($student, 'api')->putJson('/api/student/profile', ['mobile_number' => '09123456789'])->assertOk();
        $this->assertSame('09123456789', $profile->fresh()->guardian_contact);
        foreach (['', null, '   '] as $blank) {
            $profile->update(['guardian_contact' => '09123456789']);
            $this->putJson('/api/student/profile', ['mobile_number' => '09123456789', 'guardian_contact' => $blank])->assertOk();
            $this->assertNull($profile->fresh()->guardian_contact);
        }
    }

    public function test_supplied_contact_is_validated_and_mobile_remains_required(): void
    {
        $student = $this->student();
        $this->actingAs($student, 'api');
        foreach (['123', 'invalid', '+63123456789'] as $invalid) {
            $this->putJson('/api/student/profile', ['mobile_number' => '09123456789', 'guardian_contact' => $invalid])
                ->assertStatus(422)->assertJsonValidationErrors('guardian_contact');
        }
        $this->putJson('/api/student/profile', ['guardian_contact' => null])
            ->assertStatus(422)->assertJsonValidationErrors('mobile_number');
        $this->putJson('/api/student/profile', ['mobile_number' => '09123456789', 'guardian_contact' => '+639123456789'])
            ->assertOk()->assertJsonPath('data.profile.guardian_contact', '+639123456789');
    }
}
