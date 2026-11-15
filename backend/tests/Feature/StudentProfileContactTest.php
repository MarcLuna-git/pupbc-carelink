<?php

namespace Tests\Feature;

use App\Models\StudentProfile;
use App\Models\HealthProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
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
            'emergency_relationship' => 'Parent', 'emergency_phone' => '+639123456789']);
        $this->actingAs($student, 'api')->getJson('/api/student/profile')->assertOk()
            ->assertJsonPath('data.emergency_contact.name', 'Saved Contact')
            ->assertJsonPath('data.emergency_contact.phone', '+639123456789')
            ->assertJsonPath('data.emergency_contact.source', 'health_profile');
        $this->putJson('/api/student/profile', ['mobile_number' => '+639987654321', 'address' => 'Updated address'])->assertOk();
        $this->assertSame('Saved Contact', $health->fresh()->emergency_name);
        $this->assertSame('+639123456789', $health->fresh()->emergency_phone);
    }

    public function test_avatar_is_served_by_the_api_even_without_the_disk_copy(): void
    {
        Storage::fake('public');
        $student = $this->student();
        $url = $this->actingAs($student, 'api')
            ->postJson('/api/student/profile/avatar', ['avatar' => UploadedFile::fake()->image('me.png')])
            ->assertOk()->json('data.profile_picture');
        $path = $student->profile()->first()->profile_picture;
        $this->assertStringEndsWith('/api/media/' . $path, $url);
        $this->assertDatabaseHas('media_files', ['path' => $path]);

        $this->get('/api/media/' . $path)->assertOk()->assertHeader('Content-Type', 'image/png');
        // Render wipes its disk on restart; the database copy still serves it.
        Storage::disk('public')->delete($path);
        $this->get('/api/media/' . $path)->assertOk()->assertHeader('Content-Type', 'image/png');

        $this->deleteJson('/api/student/profile/avatar')->assertOk();
        $this->assertDatabaseMissing('media_files', ['path' => $path]);
        $this->get('/api/media/' . $path)->assertNotFound();
    }

    public function test_avatar_can_be_removed_and_removal_is_idempotent(): void
    {
        Storage::fake('public');
        $student = $this->student();
        $this->actingAs($student, 'api')
            ->postJson('/api/student/profile/avatar', ['avatar' => UploadedFile::fake()->image('me.jpg')])
            ->assertOk();
        $path = $student->profile()->first()->profile_picture;
        Storage::disk('public')->assertExists($path);

        $this->deleteJson('/api/student/profile/avatar')->assertOk()->assertJsonPath('data.profile_picture', null);
        Storage::disk('public')->assertMissing($path);
        $this->assertNull($student->profile()->first()->profile_picture);

        // Removing again, or without any profile row, is a harmless no-op.
        $this->deleteJson('/api/student/profile/avatar')->assertOk();
        $this->actingAs($this->student(), 'api')->deleteJson('/api/student/profile/avatar')->assertOk();
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
        $student->update(['mobile_number' => '+639123456789']);
        $profile = StudentProfile::create(['user_id' => $student->id, 'mobile_number' => '+639123456789', 'guardian_contact' => '+639123456789']);
        $this->actingAs($student, 'api')->putJson('/api/student/profile', [
            'mobile_number' => '+639123456789', 'guardian_contact' => '+639123456789', 'address' => 'Unrelated edit',
        ])->assertOk();
        $this->assertSame('+639123456789', $profile->fresh()->guardian_contact);
        foreach (['', null, '   '] as $blank) {
            $profile->update(['guardian_contact' => '+639123456789']);
            $this->putJson('/api/student/profile', ['mobile_number' => '+639123456789', 'guardian_contact' => $blank])->assertOk();
            $this->assertNull($profile->fresh()->guardian_contact);
        }
    }

    public function test_supplied_contact_is_validated_and_mobile_remains_required(): void
    {
        $student = $this->student();
        $this->actingAs($student, 'api');
        foreach (['123', 'invalid', '+63123456789'] as $invalid) {
            $this->putJson('/api/student/profile', ['mobile_number' => '+639123456789', 'guardian_contact' => $invalid])
                ->assertStatus(422)->assertJsonValidationErrors('guardian_contact');
        }
        $this->putJson('/api/student/profile', ['guardian_contact' => null])
            ->assertStatus(422)->assertJsonValidationErrors('mobile_number');
        $this->putJson('/api/student/profile', ['mobile_number' => '+639987654321', 'guardian_contact' => '+639123456789'])
            ->assertOk()->assertJsonPath('data.profile.guardian_contact', '+639123456789');
    }

    public function test_guardian_contact_cannot_match_mobile_in_another_format_or_same_request(): void
    {
        $student = $this->student();
        $student->update(['mobile_number' => '+639171234567']);
        $this->actingAs($student, 'api');
        $message = 'Emergency contact number must be different from your mobile number.';

        $this->putJson('/api/student/profile', ['mobile_number' => '+639171234567', 'guardian_contact' => '+639171234567'])
            ->assertUnprocessable()->assertJsonPath('errors.guardian_contact.0', $message);
        $this->putJson('/api/student/profile', ['mobile_number' => '+639987654321', 'guardian_contact' => '+639987654321'])
            ->assertUnprocessable()->assertJsonPath('errors.guardian_contact.0', $message);
        $this->assertSame('+639171234567', $student->fresh()->mobile_number);
        $this->assertNull(StudentProfile::where('user_id', $student->id)->first());
    }

    public function test_mobile_change_cannot_match_saved_legacy_or_health_contact(): void
    {
        $student = $this->student();
        $student->update(['mobile_number' => '+639171234567']);
        $profile = StudentProfile::create(['user_id' => $student->id, 'mobile_number' => '+639171234567', 'guardian_contact' => '+639987654321']);
        $this->actingAs($student, 'api');
        $message = 'Emergency contact number must be different from your mobile number.';

        $this->putJson('/api/student/profile', ['mobile_number' => '+639987654321'])
            ->assertUnprocessable()->assertJsonPath('errors.guardian_contact.0', $message);
        $this->assertSame('+639171234567', $student->fresh()->mobile_number);
        $this->assertSame('+639171234567', $profile->fresh()->mobile_number);

        $profile->update(['guardian_contact' => '+639123456789']);
        HealthProfile::create(['user_id' => $student->id, 'emergency_phone' => '+639987654321']);
        $this->putJson('/api/student/profile', ['mobile_number' => '+639987654321'])
            ->assertUnprocessable()->assertJsonPath('errors.guardian_contact.0', $message);
        $this->assertSame('+639171234567', $student->fresh()->mobile_number);
        $this->assertSame('+639171234567', $profile->fresh()->mobile_number);
    }

    public function test_legacy_guardian_name_uses_registration_name_rule(): void
    {
        $student = $this->student();
        $this->actingAs($student, 'api');
        foreach (['Juan2', 'Juan@', 'O’Brien', 123] as $name) {
            $this->putJson('/api/student/profile', ['mobile_number' => '+639123456789', 'guardian_name' => $name])
                ->assertUnprocessable()->assertJsonPath('errors.guardian_name.0', 'Enter a valid name.');
        }
        foreach (['Juan Dela Cruz', 'Peña', 'José', "O'Brien", 'Anne-Marie', 'Jr.'] as $name) {
            $this->putJson('/api/student/profile', ['mobile_number' => '+639123456789', 'guardian_name' => $name])
                ->assertOk()->assertJsonPath('data.profile.guardian_name', $name);
        }
        $this->assertSame('Jr.', $student->profile()->first()->guardian_name);
    }
}
