<?php

namespace Tests\Feature;

use App\Models\StudentProfile;
use App\Models\HealthProfile;
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

    public function test_profile_reads_saved_health_contact_and_contact_edits_preserve_it(): void
    {
        $student = $this->student();
        StudentProfile::create(['user_id' => $student->id, 'guardian_name' => 'Legacy contact']);
        $health = HealthProfile::create(['user_id' => $student->id, 'emergency_name' => 'Saved Contact',
            'emergency_relationship' => 'Parent', 'emergency_phone' => '09123456789']);
        $this->actingAs($student, 'api')->getJson('/api/student/profile')->assertOk()
            ->assertJsonPath('data.emergency_contact.name', 'Saved Contact')
            ->assertJsonPath('data.emergency_contact.phone', '09123456789')
            ->assertJsonPath('data.emergency_contact.source', 'health_profile');
        $this->putJson('/api/student/profile', ['mobile_number' => '09987654321', 'address' => 'Updated address'])->assertOk();
        $this->assertSame('Saved Contact', $health->fresh()->emergency_name);
        $this->assertSame('09123456789', $health->fresh()->emergency_phone);
    }

    public function test_email_change_requires_password_and_unique_email(): void
    {
        $student = $this->student();
        $other = $this->student();
        $this->actingAs($student, 'api');
        $this->patchJson('/api/student/profile/email', ['email' => 'new@example.test', 'password' => 'wrong'])
            ->assertStatus(422)->assertJsonValidationErrors('password');
        $this->assertSame($student->email, $student->fresh()->email);
        $this->patchJson('/api/student/profile/email', ['email' => $other->email, 'password' => 'TestPassword123!'])
            ->assertStatus(422)->assertJsonValidationErrors('email');
        $this->patchJson('/api/student/profile/email', ['email' => ' NEW@example.test ', 'password' => 'TestPassword123!'])
            ->assertOk()->assertJsonPath('data.email', 'new@example.test');
        $this->assertSame('new@example.test', $student->fresh()->email);
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
