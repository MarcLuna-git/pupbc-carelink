<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\AppointmentCheckin;
use App\Models\Consultation;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\MedicineStockMovement;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

class ClinicEnhancementsTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        // Kiosk check-in opens 15 minutes before to 30 minutes after the 4:30 PM slot used below.
        Carbon::setTestNow(Carbon::now('Asia/Manila')->setTime(16, 30));
    }

    private function person(string $role = 'student'): User
    {
        return User::create([
            'student_id' => 'ENH-' . Str::random(10), 'first_name' => 'Enh', 'last_name' => ucfirst($role) . Str::random(4),
            'email' => Str::uuid() . '@example.test', 'password' => Hash::make('TestPassword123!'),
            'birthday' => '2002-05-15', 'role' => $role, 'status' => null,
        ]);
    }

    private function medicine(string $name, int $quantity = 0, array $extra = []): Medicine
    {
        return Medicine::create(array_merge(['name' => $name, 'quantity' => $quantity, 'minimum_stock' => 0, 'unit' => 'tablet'], $extra));
    }

    private function receive(Medicine $medicine, string $lot, int $quantity, ?int $expiresInDays): string
    {
        return $this->postJson('/api/nurse/medicines/' . $medicine->id . '/batches', array_filter([
            'lot_number' => $lot,
            'quantity' => $quantity,
            'expiry_date' => $expiresInDays === null ? null : now()->addDays($expiresInDays)->toDateString(),
        ], fn ($value) => $value !== null))->assertCreated()->json('data.id');
    }

    private function release(Medicine $medicine, array $payload)
    {
        return $this->postJson(
            '/api/nurse/medicines/' . $medicine->id . '/movements',
            array_merge(['movement_type' => 'dispensed', 'reason' => 'Clinic visit'], $payload),
            ['If-Match' => $medicine->fresh()->sync_version]
        );
    }

    public function test_stock_goes_out_first_expiry_first_and_batch_balances_stay_true(): void
    {
        $nurse = $this->person('nurse');
        $student = $this->person();
        $this->actingAs($nurse, 'api');

        // 2 units were never entered as a batch (older stock).
        $medicine = $this->medicine('FEFO ' . Str::random(6), 2, ['added_by' => $nurse->id]);
        $late = $this->receive($medicine, 'LATE', 5, 200);
        $soon = $this->receive($medicine, 'SOON', 4, 60);
        $none = $this->receive($medicine, 'NODATE', 3, null);
        $this->assertSame(14, $medicine->fresh()->quantity);

        // Earliest expiry first, then the next one.
        $first = $this->release($medicine, ['quantity' => 6, 'student_id' => $student->student_id])->assertOk();
        $this->assertSame(['SOON', 'LATE'], array_column($first->json('allocations'), 'lot_number'));
        $this->assertSame([4, 2], array_column($first->json('allocations'), 'quantity'));
        $this->assertSame(0, MedicineBatch::findOrFail($soon)->quantity);
        $this->assertSame(3, MedicineBatch::findOrFail($late)->quantity);
        $this->assertSame(8, $medicine->fresh()->quantity);

        // Batches without a date come after dated ones.
        $second = $this->release($medicine, ['quantity' => 5, 'student_id' => $student->student_id])->assertOk();
        $this->assertSame(['LATE', 'NODATE'], array_column($second->json('allocations'), 'lot_number'));
        $this->assertSame(0, MedicineBatch::findOrFail($late)->quantity);
        $this->assertSame(1, MedicineBatch::findOrFail($none)->quantity);

        // Stock that never had a batch goes last.
        $third = $this->release($medicine, ['quantity' => 3, 'student_id' => $student->student_id])->assertOk();
        $this->assertSame(['NODATE', null], array_column($third->json('allocations'), 'lot_number'));
        $this->assertSame(0, MedicineBatch::findOrFail($none)->quantity);
        $this->assertSame(0, $medicine->fresh()->quantity);

        // One movement per batch used, so the history adds up to what left the shelf.
        $this->assertSame(6, MedicineStockMovement::where('medicine_id', $medicine->id)->where('movement_type', 'dispensed')->count());
        $this->assertSame(14, (int) MedicineStockMovement::where('medicine_id', $medicine->id)->where('movement_type', 'dispensed')->sum('quantity'));

        $this->release($medicine, ['quantity' => 1, 'student_id' => $student->student_id])->assertUnprocessable();
    }

    public function test_expired_batches_are_never_dispensed_but_can_be_written_off(): void
    {
        $nurse = $this->person('nurse');
        $student = $this->person();
        $this->actingAs($nurse, 'api');

        $medicine = $this->medicine('Expired ' . Str::random(6), 5);
        $old = MedicineBatch::create(['medicine_id' => $medicine->id, 'lot_number' => 'OLD', 'quantity' => 5, 'expiry_date' => now()->subDay()->toDateString()]);

        $blocked = $this->release($medicine, ['quantity' => 1, 'student_id' => $student->student_id])->assertUnprocessable();
        $this->assertStringContainsString('unexpired', $blocked->json('message'));
        $this->release($medicine, ['quantity' => 1, 'student_id' => $student->student_id, 'batch_id' => $old->id])
            ->assertUnprocessable();
        $this->assertSame(5, $medicine->fresh()->quantity);

        $this->release($medicine, ['movement_type' => 'expired', 'quantity' => 5, 'reason' => 'Past expiry date'])->assertOk();
        $this->assertSame(0, $old->fresh()->quantity);
        $this->assertSame(0, $medicine->fresh()->quantity);
    }

    public function test_medicine_expiry_follows_the_earliest_stocked_batch(): void
    {
        $this->actingAs($this->person('nurse'), 'api');
        $tag = 'EXP' . Str::random(5);

        // A: own date is far away, but a stocked batch expires in 30 days; an emptied expired batch is ignored.
        $a = $this->medicine("$tag A", 2, ['expiry_date' => now()->addDays(400)->toDateString()]);
        MedicineBatch::create(['medicine_id' => $a->id, 'lot_number' => 'A1', 'quantity' => 2, 'expiry_date' => now()->addDays(30)->toDateString()]);
        MedicineBatch::create(['medicine_id' => $a->id, 'lot_number' => 'A0', 'quantity' => 0, 'expiry_date' => now()->subDays(5)->toDateString()]);
        // B: no batches, own date already passed.
        $b = $this->medicine("$tag B", 1, ['expiry_date' => now()->subDay()->toDateString()]);
        // C: no batches, own date far away.
        $this->medicine("$tag C", 1, ['expiry_date' => now()->addDays(400)->toDateString()]);

        $rows = collect($this->getJson('/api/nurse/medicines?search=' . $tag)->assertOk()->json('data.data'))->keyBy('name');
        $this->assertSame(now()->addDays(30)->toDateString(), $rows["$tag A"]['next_expiry']);
        $this->assertTrue($rows["$tag A"]['is_expiring_soon']);
        $this->assertFalse($rows["$tag A"]['is_expired']);
        $this->assertSame(1, $rows["$tag A"]['batch_count']);
        $this->assertTrue($rows["$tag B"]['is_expired']);
        $this->assertFalse($rows["$tag C"]['is_expiring_soon']);

        $soon = collect($this->getJson('/api/nurse/medicines?expiring_soon=1&search=' . $tag)->json('data.data'))->pluck('name')->all();
        $this->assertEqualsCanonicalizing(["$tag A", "$tag B"], $soon);
        $expired = collect($this->getJson('/api/nurse/medicines?expired=1&search=' . $tag)->json('data.data'))->pluck('name')->all();
        $this->assertSame(["$tag B"], $expired);
    }

    private function appointment(User $student): Appointment
    {
        return Appointment::create(['user_id' => $student->id, 'service' => 'General Checkup', 'appointment_date' => today()->toDateString(), 'time_slot' => '4:30 PM', 'status' => 'approved']);
    }

    private function checkIn(User $student, array $extra = [])
    {
        return $this->withHeader('X-Kiosk-Token', config('kiosk.device_token'))->postJson('/api/kiosk/checkin', array_merge([
            'student_id' => $student->student_id, 'method' => 'manual', 'chief_complaint' => 'Headache', 'severity' => 'mild', 'red_flags' => ['none'],
        ], $extra));
    }

    private function visit(): array
    {
        $student = $this->person();
        $appointment = $this->appointment($student);
        $checkin = AppointmentCheckin::findOrFail($this->checkIn($student)->assertCreated()->json('data.id'));

        return [$student, $appointment, $checkin];
    }

    public function test_attending_nurse_can_be_chosen_and_defaults_to_the_signed_in_nurse(): void
    {
        $nurse = $this->person('nurse');
        $other = $this->person('nurse');
        $student = $this->person();
        $this->actingAs($nurse, 'api');

        $ids = collect($this->getJson('/api/nurse/nurses')->assertOk()->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($nurse->id) && $ids->contains($other->id));
        $this->assertFalse($ids->contains($student->id));

        [$patient, $appointment, $checkin] = $this->visit();
        $this->postJson('/api/nurse/queue/call-next')->assertOk();
        $data = ['user_id' => $patient->id, 'appointment_id' => $appointment->id, 'appointment_checkin_id' => $checkin->id, 'chief_complaint' => 'Headache', 'history_present_illness' => 'Since this morning', 'nursing_assessment' => 'Alert and oriented', 'nursing_interventions' => 'Advised rest'];

        // Only a nurse account can be named.
        $this->postJson('/api/nurse/consultations', array_merge($data, ['attending_nurse_id' => $student->id]))->assertUnprocessable();
        $this->assertSame(0, Consultation::where('appointment_checkin_id', $checkin->id)->count());

        $created = $this->postJson('/api/nurse/consultations', array_merge($data, ['attending_nurse_id' => $other->id]))->assertCreated();
        $this->assertSame($other->id, Consultation::findOrFail($created->json('data.id'))->nurse_id);

        // Left blank, the signed-in nurse is the attending nurse (previous behaviour).
        [$patient2, $appointment2, $checkin2] = $this->visit();
        $this->postJson('/api/nurse/queue/call-next')->assertOk();
        $created2 = $this->postJson('/api/nurse/consultations', ['user_id' => $patient2->id, 'appointment_id' => $appointment2->id, 'appointment_checkin_id' => $checkin2->id, 'chief_complaint' => 'Cough', 'history_present_illness' => 'Since this morning', 'nursing_assessment' => 'Alert and oriented', 'nursing_interventions' => 'Advised rest'])->assertCreated();
        $this->assertSame($nurse->id, Consultation::findOrFail($created2->json('data.id'))->nurse_id);
    }

    public function test_students_cannot_list_the_nurse_accounts(): void
    {
        $this->actingAs($this->person(), 'api')->getJson('/api/nurse/nurses')->assertForbidden();
    }

    public function test_kiosk_check_in_stores_the_pain_rating(): void
    {
        $withPain = $this->person();
        $this->appointment($withPain);
        $id = $this->checkIn($withPain, ['pain_level' => 7])->assertCreated()->json('data.id');
        $this->assertSame(7, AppointmentCheckin::findOrFail($id)->triage->pain_level);

        $noPain = $this->person();
        $this->appointment($noPain);
        $id = $this->checkIn($noPain, ['pain_level' => 0])->assertCreated()->json('data.id');
        $this->assertSame(0, AppointmentCheckin::findOrFail($id)->triage->pain_level);

        // Older kiosk screens do not send it; that stays valid.
        $legacy = $this->person();
        $this->appointment($legacy);
        $id = $this->checkIn($legacy)->assertCreated()->json('data.id');
        $this->assertNull(AppointmentCheckin::findOrFail($id)->triage->pain_level);

        foreach ([11, -1, 'bad'] as $invalid) {
            $student = $this->person();
            $this->appointment($student);
            $this->checkIn($student, ['pain_level' => $invalid])->assertUnprocessable()->assertJsonValidationErrors('pain_level');
            $this->assertSame(0, AppointmentCheckin::where('user_id', $student->id)->count());
        }
    }

    public function test_the_nurse_queue_includes_the_pain_rating(): void
    {
        $student = $this->person();
        $this->appointment($student);
        $this->checkIn($student, ['pain_level' => 9, 'severity' => 'moderate'])->assertCreated();

        $queue = $this->actingAs($this->person('nurse'), 'api')->getJson('/api/nurse/queue/today')->assertOk()->json('data.queue');
        $row = collect($queue)->firstWhere('user_id', $student->id);
        $this->assertSame(9, $row['triage']['pain_level']);
    }
}
