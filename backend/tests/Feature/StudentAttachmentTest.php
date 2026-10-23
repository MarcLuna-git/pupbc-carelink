<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class StudentAttachmentTest extends TestCase
{
    use DatabaseTransactions;

    private function user(string $role): User
    {
        return User::create([
            'first_name' => 'Attach', 'last_name' => ucfirst($role),
            'student_id' => $role === 'student' ? 'ATTACH-' . Str::random(12) : null,
            'email' => Str::uuid() . '@example.test',
            'password' => Hash::make('TestPassword123!'), 'role' => $role,
        ]);
    }

    public function test_nurse_attaches_views_and_deletes_a_student_file(): void
    {
        Storage::fake('local');
        $student = $this->user('student');
        $nurse = $this->user('nurse');

        $id = $this->actingAs($nurse, 'api')
            ->post("/api/nurse/students/{$student->id}/attachments", [
                'file' => UploadedFile::fake()->image('chest-xray.png'),
                'category' => 'xray',
                'description' => 'Chest PA view',
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.category', 'xray')
            ->assertJsonPath('data.original_name', 'chest-xray.png')
            ->assertJsonMissingPath('data.contents')
            ->json('data.id');

        $this->getJson("/api/nurse/students/{$student->id}/attachments")
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonMissingPath('data.0.path');

        $file = "/api/nurse/students/{$student->id}/attachments/{$id}/file";
        $this->get($file)->assertOk()->assertHeader('Content-Type', 'image/png');
        // Render wipes its disk on restart; the database copy still serves it.
        Storage::disk('local')->deleteDirectory('student-attachments');
        $this->get($file)->assertOk()->assertHeader('Content-Type', 'image/png');

        $this->deleteJson("/api/nurse/students/{$student->id}/attachments/{$id}")->assertOk();
        $this->assertDatabaseMissing('student_attachments', ['id' => $id]);
    }

    public function test_students_cannot_reach_attachments_and_risky_files_are_rejected(): void
    {
        Storage::fake('local');
        $student = $this->user('student');
        $nurse = $this->user('nurse');

        $this->actingAs($student, 'api')->getJson("/api/nurse/students/{$student->id}/attachments")->assertForbidden();

        $this->actingAs($nurse, 'api')
            ->post("/api/nurse/students/{$student->id}/attachments", [
                'file' => UploadedFile::fake()->create('page.html', 1, 'text/html'),
                'category' => 'other',
            ], ['Accept' => 'application/json'])
            ->assertStatus(422);
    }
}
