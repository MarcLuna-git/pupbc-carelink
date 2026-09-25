<?php

namespace Tests\Feature;

use App\Models\{Appointment, Consultation, Medicine, MedicineBatch, User};
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

class DatabaseQueryCompatibilityTest extends TestCase
{
    use DatabaseTransactions;

    private function person(string $role, string $name): User
    {
        return User::create([
            'student_id' => 'SEARCH-' . Str::random(12), 'first_name' => $name, 'last_name' => 'Test',
            'email' => Str::uuid() . '@example.test', 'password' => 'unused', 'role' => $role, 'status' => null,
        ]);
    }

    public function test_nurse_searches_keep_case_insensitive_matching(): void
    {
        Mail::fake();
        $name = 'MixedCase' . Str::random(12);
        $student = $this->person('student', $name);
        $nurse = $this->person('nurse', 'Nurse');
        $appointment = Appointment::create([
            'user_id' => $student->id, 'service' => 'Consultation',
            'appointment_date' => '2026-09-29', 'time_slot' => '8:00 AM', 'status' => 'approved',
        ]);
        $consultation = Consultation::create([
            'user_id' => $student->id, 'nurse_id' => $nurse->id, 'appointment_id' => $appointment->id,
            'status' => 'completed',
        ]);
        $medicine = Medicine::create(['name' => $name, 'quantity' => 0]);
        $this->actingAs($nurse, 'api');
        foreach (['students' => $student, 'appointments' => $appointment, 'consultations' => $consultation, 'medicines' => $medicine] as $resource => $model) {
            $this->getJson('/api/nurse/' . $resource . '?search=' . strtolower($name))
                ->assertOk()->assertJsonPath('data.total', 1)->assertJsonPath('data.data.0.id', $model->id);
        }
        $this->getJson('/api/nurse/students/search?q=' . strtoupper($name))
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $student->id);
        Mail::assertNothingSent();
    }

    public function test_batch_listing_keeps_null_expiry_first_then_calendar_order(): void
    {
        $this->actingAs($this->person('nurse', 'Nurse'), 'api');
        $medicine = Medicine::create(['name' => 'Batch ordering', 'quantity' => 3]);
        $ids = [];
        foreach (['2026-09-29', null, '2026-09-24'] as $index => $date) {
            $ids[] = MedicineBatch::create([
                'medicine_id' => $medicine->id, 'lot_number' => 'LOT-' . $index,
                'quantity' => 1, 'expiry_date' => $date,
            ])->id;
        }
        $this->getJson('/api/nurse/medicines/' . $medicine->id . '/batches')
            ->assertOk()->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.id', $ids[1])->assertJsonPath('data.1.id', $ids[2])
            ->assertJsonPath('data.2.id', $ids[0]);
    }

    public function test_academic_index_metadata_can_be_read_without_running_migration(): void
    {
        ob_start();
        try {
            $migration = require __DIR__ . '/../../database/migrations/2026_09_23_000003_create_academic_management_tables.php';
        } finally {
            ob_end_clean();
        }
        $method = new \ReflectionMethod($migration, 'uniqueIndexColumns');
        $method->setAccessible(true);
        $indexes = $method->invoke($migration); // SELECT only; never calls up/down.
        $this->assertNotEmpty($indexes);
        foreach ($indexes as $index) {
            foreach (['index_name', 'column_name', 'ordinal_position', 'is_primary'] as $attribute) {
                $this->assertTrue(property_exists($index, $attribute), 'Missing index metadata: ' . $attribute);
            }
        }
    }
}
