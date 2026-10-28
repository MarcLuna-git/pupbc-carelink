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

        $created = $this->actingAs($nurse, 'api')
            ->post("/api/nurse/students/{$student->id}/attachments", [
                'file' => UploadedFile::fake()->image('chest-xray.png'),
                'category' => 'xray',
                'description' => 'Chest PA view',
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.category', 'xray')
            ->assertJsonPath('data.original_name', 'chest-xray.png');
        // assertJsonMissingPath does not exist in this Laravel 8 build; check the keys directly.
        $this->assertArrayNotHasKey('contents', $created->json('data'));
        $id = $created->json('data.id');

        $listed = $this->getJson("/api/nurse/students/{$student->id}/attachments")
            ->assertOk()->assertJsonCount(1, 'data');
        $this->assertArrayNotHasKey('path', $listed->json('data.0'));

        $file = "/api/nurse/students/{$student->id}/attachments/{$id}/file";
        $this->get($file)->assertOk()->assertHeader('Content-Type', 'image/png');
        // Render wipes its disk on restart; the database copy still serves it.
        Storage::disk('local')->deleteDirectory('student-attachments');
        $this->get($file)->assertOk()->assertHeader('Content-Type', 'image/png');

        $this->deleteJson("/api/nurse/students/{$student->id}/attachments/{$id}")->assertOk();
        $this->assertDatabaseMissing('student_attachments', ['id' => $id]);
    }

    public function test_photos_are_limited_to_200_kb_but_documents_are_not(): void
    {
        Storage::fake('local');
        $student = $this->user('student');
        $nurse = $this->user('nurse');
        $url = "/api/nurse/students/{$student->id}/attachments";
        $send = fn($file) => $this->actingAs($nurse, 'api')->post($url, ['file' => $file, 'category' => 'xray'], ['Accept' => 'application/json']);

        $send(UploadedFile::fake()->image('big-xray.jpg', 800, 800)->size(300))
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');
        $this->assertDatabaseCount('student_attachments', 0);

        // Right at the limit, and the other photo types, are accepted.
        $send(UploadedFile::fake()->image('ok-xray.jpg', 800, 800)->size(200))->assertCreated();
        $send(UploadedFile::fake()->image('small.png', 200, 200)->size(40))->assertCreated();
        $send(UploadedFile::fake()->image('over.png', 800, 800)->size(201))->assertStatus(422);

        // A scanned prescription or a report is a document, not a photo: it keeps the larger limit.
        $send(UploadedFile::fake()->create('rx.pdf', 1500, 'application/pdf'))->assertCreated();
        $send(UploadedFile::fake()->create('too-big.pdf', 11000, 'application/pdf'))->assertStatus(422);
        $this->assertDatabaseCount('student_attachments', 3);
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
