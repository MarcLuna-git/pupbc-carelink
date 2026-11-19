<?php

namespace Tests\Feature;

use App\Models\{Appointment, AuditLog, Notification, StudentAttachment, User};
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\{Hash, Storage};
use Illuminate\Support\Str;
use Tests\TestCase;

class NurseStudentDeleteTest extends TestCase
{
    use DatabaseTransactions;

    private function person(string $role = 'student'): User
    {
        return User::create([
            'student_id' => $role === 'student' ? 'DEL-' . Str::random(10) : null,
            'first_name' => 'Delete', 'last_name' => 'Test',
            'email' => Str::uuid() . '@example.test',
            'password' => Hash::make('TestPassword123!'),
            'role' => $role, 'status' => null,
        ]);
    }

    private function studentWithRecords(User $nurse): array
    {
        $student = $this->person();
        $appointment = Appointment::create(['user_id' => $student->id, 'service' => 'General Checkup', 'appointment_date' => today('Asia/Manila')->subDays(3)->toDateString(), 'time_slot' => '8:00 AM', 'status' => 'completed']);
        $notification = Notification::create(['user_id' => $student->id, 'type' => 'test', 'title' => 'Test', 'message' => 'Test']);
        $path = 'student-attachments/' . $student->id . '/xray.pdf';
        Storage::disk('local')->put($path, 'file');
        $attachment = StudentAttachment::create(['user_id' => $student->id, 'uploaded_by' => $nurse->id, 'category' => 'other', 'original_name' => 'xray.pdf', 'mime_type' => 'application/pdf', 'size' => 4, 'path' => $path, 'contents' => base64_encode('file')]);

        return [$student, $appointment, $notification, $attachment, $path];
    }

    public function test_wrong_admin_password_deletes_nothing()
    {
        Storage::fake('local');
        config(['dev_tools.password' => 'admin']);
        $nurse = $this->person('nurse');
        [$student, $appointment, , , $path] = $this->studentWithRecords($nurse);

        $this->actingAs($nurse, 'api')
            ->deleteJson('/api/nurse/students/' . $student->id, ['password' => 'wrong'])
            ->assertStatus(422)
            ->assertJsonPath('errors.password.0', 'Incorrect admin password.');

        $this->assertNotNull(User::find($student->id));
        $this->assertNotNull(Appointment::find($appointment->id));
        Storage::disk('local')->assertExists($path);
    }

    public function test_admin_password_deletes_the_student_and_all_their_data()
    {
        Storage::fake('local');
        config(['dev_tools.password' => 'admin']);
        $nurse = $this->person('nurse');
        [$student, $appointment, $notification, $attachment, $path] = $this->studentWithRecords($nurse);

        $this->actingAs($nurse, 'api')
            ->deleteJson('/api/nurse/students/' . $student->id, ['password' => 'admin'])
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertNull(User::withTrashed()->find($student->id));
        $this->assertNull(Appointment::withTrashed()->find($appointment->id));
        $this->assertNull(Notification::find($notification->id));
        $this->assertNull(StudentAttachment::find($attachment->id));
        Storage::disk('local')->assertMissing($path);

        // Who deleted it stays in the audit log, under the nurse.
        $this->assertTrue(AuditLog::where('user_id', $nurse->id)->where('action', 'student_deleted')
            ->where('description', 'like', '%' . $student->student_id . '%')->exists());

        // The Student ID and email are free again for a new registration.
        $this->assertFalse(User::withTrashed()->where('student_id', $student->student_id)->exists());
    }

    public function test_archived_student_can_be_deleted_too()
    {
        Storage::fake('local');
        config(['dev_tools.password' => 'admin']);
        $nurse = $this->person('nurse');
        $student = $this->person();
        $this->actingAs($nurse, 'api')->patchJson('/api/nurse/students/' . $student->id . '/archive', ['reason' => 'Test account'])->assertOk();

        $this->deleteJson('/api/nurse/students/' . $student->id, ['password' => 'admin'])->assertOk();
        $this->assertNull(User::withTrashed()->find($student->id));
    }

    public function test_students_cannot_use_the_delete_endpoint()
    {
        config(['dev_tools.password' => 'admin']);
        $student = $this->person();
        $other = $this->person();

        $this->actingAs($student, 'api')
            ->deleteJson('/api/nurse/students/' . $other->id, ['password' => 'admin'])
            ->assertStatus(403);
        $this->assertNotNull(User::find($other->id));
    }
}
