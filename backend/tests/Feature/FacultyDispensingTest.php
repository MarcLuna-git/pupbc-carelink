<?php

namespace Tests\Feature;

use App\Models\FacultyDispensing;
use App\Models\FacultyMember;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\MedicineStockMovement;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/*
 * The Faculty page: the directory, giving medicine to a faculty member (the stock comes out first-expiry,
 * first-out like for a student), and the Dispensing History.
 */
class FacultyDispensingTest extends TestCase
{
    use DatabaseTransactions;

    private function person(string $role): User
    {
        return User::create([
            'student_id' => 'FAC-' . Str::random(10), 'first_name' => 'Fac', 'last_name' => ucfirst($role) . Str::random(4),
            'email' => Str::uuid() . '@example.test', 'password' => Hash::make('TestPassword123!'),
            'birthday' => '2002-05-15', 'role' => $role, 'status' => null,
        ]);
    }

    private function faculty(string $name, array $extra = []): FacultyMember
    {
        return FacultyMember::create(array_merge(['full_name' => $name, 'faculty_type' => 'full_time', 'course' => 'BSIT', 'status' => 'active'], $extra));
    }

    private function medicine(string $name, array $extra = []): Medicine
    {
        return Medicine::create(array_merge(['name' => $name, 'quantity' => 0, 'minimum_stock' => 5, 'unit' => 'tablet'], $extra));
    }

    private function receive(Medicine $medicine, string $lot, int $quantity, int $expiresInDays): void
    {
        $this->postJson("/api/nurse/medicines/{$medicine->id}/batches", ['lot_number' => $lot, 'quantity' => $quantity, 'expiry_date' => now()->addDays($expiresInDays)->toDateString()])->assertCreated();
    }

    public function test_the_directory_adds_validates_filters_pages_and_counts(): void
    {
        $this->actingAs($this->person('nurse'), 'api');
        $tag = 'DIR' . Str::upper(Str::random(6));

        $created = $this->postJson('/api/nurse/faculty', ['full_name' => "$tag Maria Santos", 'faculty_type' => 'full_time', 'course' => 'BSIT', 'designation' => 'Professor',
            'department' => 'College of Information Technology', 'email' => 'maria@school.edu', 'phone' => '+63 912 345 6789', 'notes' => 'Allergic to penicillin'])
            ->assertCreated()->assertJsonPath('data.status', 'active')->assertJsonPath('data.faculty_type', 'full_time');

        // The same name in the same course is a duplicate; the same name in another course is not.
        $this->postJson('/api/nurse/faculty', ['full_name' => strtolower("$tag Maria Santos"), 'faculty_type' => 'part_time', 'course' => 'BSIT'])->assertStatus(422)->assertJsonValidationErrors('full_name');
        $this->postJson('/api/nurse/faculty', ['full_name' => "$tag Maria Santos", 'faculty_type' => 'part_time', 'course' => 'BSBA'])->assertCreated();
        $this->postJson('/api/nurse/faculty', ['full_name' => "$tag Bad Type", 'faculty_type' => 'visiting', 'course' => 'BSIT'])->assertStatus(422)->assertJsonValidationErrors('faculty_type');
        $this->postJson('/api/nurse/faculty', ['full_name' => "$tag No Course", 'faculty_type' => 'full_time'])->assertStatus(422)->assertJsonValidationErrors('course');
        $this->postJson('/api/nurse/faculty', ['full_name' => "$tag Bad Email", 'faculty_type' => 'full_time', 'course' => 'BSIT', 'email' => 'not-an-email'])->assertStatus(422)->assertJsonValidationErrors('email');

        $this->faculty("$tag John Reyes", ['faculty_type' => 'part_time']);
        $this->faculty("$tag Ana Cruz", ['course' => 'BSED']);
        $this->faculty("$tag Luis Pascual", ['faculty_type' => 'part_time', 'status' => 'inactive']);
        // 5 in this test: Maria (BSIT, full), Maria (BSBA, part), John (BSIT, part), Ana (BSED, full), Luis (BSIT, part, inactive)

        $names = fn (string $query) => collect($this->getJson("/api/nurse/faculty?search=$tag$query")->assertOk()->json('data.data'))->pluck('full_name')->map(fn ($n) => str_replace("$tag ", '', $n))->all();
        $this->assertSame(['Ana Cruz', 'John Reyes', 'Luis Pascual', 'Maria Santos', 'Maria Santos'], $names(''));
        $this->assertSame(['John Reyes', 'Luis Pascual', 'Maria Santos'], $names('&type=part_time'));
        $this->assertSame(['Ana Cruz'], $names('&course=BSED'));
        $this->assertSame(['Luis Pascual'], $names('&status=inactive'));
        $this->assertSame(['Maria Santos'], $names('&type=full_time&course=BSIT'));

        $page = $this->getJson("/api/nurse/faculty?search=$tag&per_page=2&page=3")->assertOk();
        $page->assertJsonPath('data.total', 5)->assertJsonPath('data.last_page', 3)->assertJsonPath('data.from', 5);

        // The cards count everyone in the directory, whatever the filters, and add up.
        $stats = $this->getJson("/api/nurse/faculty?search=$tag&type=part_time")->json('stats');
        $this->assertGreaterThanOrEqual(5, $stats['total']);
        $this->assertSame($stats['total'], $stats['full_time'] + $stats['part_time']);
        $this->assertContains('BSED', $this->getJson('/api/nurse/faculty')->json('courses'));

        $show = $this->getJson('/api/nurse/faculty/' . $created->json('data.id'))->assertOk();
        $show->assertJsonPath('data.email', 'maria@school.edu')->assertJsonPath('dispensing_count', 0);
        $this->assertSame([], $show->json('recent_dispensings'));
    }

    public function test_edit_needs_the_current_version_and_delete_keeps_the_history(): void
    {
        $this->actingAs($this->person('nurse'), 'api');
        $tag = 'EDT' . Str::upper(Str::random(6));
        $created = $this->postJson('/api/nurse/faculty', ['full_name' => "$tag Karen Dela Cruz", 'faculty_type' => 'full_time', 'course' => 'BSBA'])->assertCreated();
        $id = $created->json('data.id');
        $version = $created->json('data.sync_version');

        $this->putJson("/api/nurse/faculty/$id", ['status' => 'inactive'])->assertStatus(428);
        $this->putJson("/api/nurse/faculty/$id", ['status' => 'inactive', 'notes' => '  On leave  '], ['If-Match' => $version])
            ->assertOk()->assertJsonPath('data.status', 'inactive')->assertJsonPath('data.notes', 'On leave');
        // The old version is refused (someone else changed the record).
        $this->putJson("/api/nurse/faculty/$id", ['status' => 'active'], ['If-Match' => $version])->assertStatus(409);
        $this->putJson("/api/nurse/faculty/$id", ['status' => 'sleeping'], ['If-Match' => FacultyMember::findOrFail($id)->sync_version])->assertStatus(422);

        // Medicine already given stays on the record after the faculty member is deleted.
        $faculty = FacultyMember::findOrFail($id);
        $faculty->update(['status' => 'active']);
        $medicine = $this->medicine("$tag Paracetamol");
        $this->receive($medicine, 'L1', 10, 60);
        $this->postJson("/api/nurse/faculty/$id/dispense", ['medicine_id' => $medicine->id, 'quantity' => 1, 'reason' => 'Headache'])->assertCreated();

        $this->deleteJson("/api/nurse/faculty/$id", [], ['If-Match' => FacultyMember::findOrFail($id)->sync_version])->assertOk();
        $this->getJson("/api/nurse/faculty/$id")->assertNotFound();
        $this->assertSame(0, collect($this->getJson("/api/nurse/faculty?search=$tag")->json('data.data'))->count());
        $history = $this->getJson("/api/nurse/faculty-dispensings?faculty_id=$id")->assertOk();
        $history->assertJsonPath('data.total', 1)->assertJsonPath('data.data.0.faculty.full_name', "$tag Karen Dela Cruz");
    }

    public function test_dispensing_takes_the_stock_first_expiry_first_and_records_who_got_it(): void
    {
        $nurse = $this->person('nurse');
        $this->actingAs($nurse, 'api');
        $tag = 'DSP' . Str::upper(Str::random(6));
        $faculty = $this->faculty("$tag Maria Santos");
        $medicine = $this->medicine("$tag Paracetamol 500mg");
        $this->receive($medicine, 'LATE', 10, 90);
        $this->receive($medicine, 'SOON', 10, 30);
        $this->assertSame(20, $medicine->fresh()->quantity);

        $response = $this->postJson("/api/nurse/faculty/{$faculty->id}/dispense", ['medicine_id' => $medicine->id, 'quantity' => 12, 'reason' => '  Headache  '])->assertCreated();
        $response->assertJsonPath('data.quantity', 12)->assertJsonPath('data.reason', 'Headache')->assertJsonPath('data.medicine_name', "$tag Paracetamol 500mg")
            ->assertJsonPath('data.unit', 'tablet')->assertJsonPath('data.dispenser.id', $nurse->id)->assertJsonPath('medicine.quantity', 8)
            ->assertJsonPath('message', "Dispensed 12 tablet of $tag Paracetamol 500mg to $tag Maria Santos.");

        // The batch that expires first goes first: SOON x10, then LATE x2.
        $this->assertSame([['SOON', 10], ['LATE', 2]], array_map(fn ($line) => [$line['lot_number'], $line['quantity']], $response->json('allocations')));
        $this->assertSame(0, MedicineBatch::where('medicine_id', $medicine->id)->where('lot_number', 'SOON')->value('quantity'));
        $this->assertSame(8, MedicineBatch::where('medicine_id', $medicine->id)->where('lot_number', 'LATE')->value('quantity'));
        $this->assertSame(8, $medicine->fresh()->quantity);

        // One dispensing row, and a movement per batch that names the faculty member.
        $this->assertSame(1, FacultyDispensing::where('faculty_member_id', $faculty->id)->count());
        $this->assertSame(2, MedicineStockMovement::where('faculty_member_id', $faculty->id)->where('movement_type', 'dispensed')->count());
        $lines = $this->getJson("/api/nurse/medicines/{$medicine->id}/movements?type=dispensed")->assertOk()->json('data.data');
        $this->assertCount(2, $lines);
        $this->assertSame(["$tag Maria Santos", "$tag Maria Santos"], array_column(array_column($lines, 'faculty'), 'full_name'));
        $this->assertSame('Headache', $lines[0]['reason']);
        $this->assertSame(8, $lines[0]['stock_after']);

        // More than is in stock, and a nobody-in-particular medicine, are refused and change nothing.
        $this->postJson("/api/nurse/faculty/{$faculty->id}/dispense", ['medicine_id' => $medicine->id, 'quantity' => 9, 'reason' => 'Fever'])
            ->assertStatus(422)->assertJsonPath('message', 'Only 8 tablet in stock.');
        $this->assertSame(8, $medicine->fresh()->quantity);
        $this->assertSame(1, FacultyDispensing::where('faculty_member_id', $faculty->id)->count());
        $this->postJson("/api/nurse/faculty/{$faculty->id}/dispense", ['medicine_id' => (string) Str::uuid(), 'quantity' => 1, 'reason' => 'Fever'])->assertStatus(422)->assertJsonValidationErrors('medicine_id');

        // The rest of the checks on the request itself.
        foreach ([['quantity' => 0], ['quantity' => 'many'], ['reason' => ''], ['reason' => '   '], ['medicine_id' => 'abc']] as $bad) {
            $this->postJson("/api/nurse/faculty/{$faculty->id}/dispense", array_merge(['medicine_id' => $medicine->id, 'quantity' => 1, 'reason' => 'Fever'], $bad))->assertStatus(422);
        }
        $this->postJson('/api/nurse/faculty/' . Str::uuid() . '/dispense', ['medicine_id' => $medicine->id, 'quantity' => 1, 'reason' => 'Fever'])->assertNotFound();
        $this->assertSame(8, $medicine->fresh()->quantity);
    }

    public function test_an_inactive_faculty_member_or_expired_stock_cannot_be_dispensed(): void
    {
        $this->actingAs($this->person('nurse'), 'api');
        $tag = 'BLK' . Str::upper(Str::random(6));
        $medicine = $this->medicine("$tag Cetirizine");
        $this->receive($medicine, 'OK', 5, 60);

        $inactive = $this->faculty("$tag On Leave", ['status' => 'inactive']);
        $this->postJson("/api/nurse/faculty/{$inactive->id}/dispense", ['medicine_id' => $medicine->id, 'quantity' => 1, 'reason' => 'Allergy'])
            ->assertStatus(422)->assertJsonPath('message', 'This faculty member is inactive. Make them active before dispensing.');

        // Stock that has expired is never given out.
        $expired = $this->medicine("$tag Old Syrup", ['quantity' => 5]);
        MedicineBatch::create(['medicine_id' => $expired->id, 'lot_number' => 'OLD', 'quantity' => 5, 'expiry_date' => now()->subDay()->toDateString()]);
        $active = $this->faculty("$tag Active");
        $this->postJson("/api/nurse/faculty/{$active->id}/dispense", ['medicine_id' => $expired->id, 'quantity' => 1, 'reason' => 'Cough'])->assertStatus(422);
        $this->assertSame(5, $expired->fresh()->quantity);
        $this->assertSame(0, FacultyDispensing::where('faculty_member_id', $active->id)->count());
    }

    public function test_the_dispensing_history_filters_by_faculty_and_clinic_day_and_pages(): void
    {
        $nurse = $this->person('nurse');
        $this->actingAs($nurse, 'api');
        $tag = 'HST' . Str::upper(Str::random(6));
        $maria = $this->faculty("$tag Maria Santos");
        $john = $this->faculty("$tag John Reyes", ['faculty_type' => 'part_time']);
        $medicine = $this->medicine("$tag Vitamin C");
        $this->receive($medicine, 'V1', 50, 200);
        $give = fn (FacultyMember $who, string $when, string $reason) => tap(Carbon::setTestNow(Carbon::parse($when, 'Asia/Manila')), fn () =>
            $this->postJson("/api/nurse/faculty/{$who->id}/dispense", ['medicine_id' => $medicine->id, 'quantity' => 1, 'reason' => $reason])->assertCreated());

        $give($maria, '2026-10-12 10:24:00', 'Headache');
        $give($john, '2026-10-28 23:30:00', 'Cold symptoms');
        $give($maria, '2026-10-29 00:30:00', 'Fever');
        Carbon::setTestNow();

        $reasons = fn (string $query) => collect($this->getJson("/api/nurse/faculty-dispensings?faculty_id=$maria->id$query")->assertOk()->json('data.data'))->pluck('reason')->all();
        $all = $this->getJson('/api/nurse/faculty-dispensings?per_page=100')->json('data.data');
        $mine = array_values(array_filter($all, fn ($row) => str_starts_with($row['medicine_name'], $tag)));
        $this->assertSame(['Fever', 'Cold symptoms', 'Headache'], array_column($mine, 'reason'), 'newest first');
        $this->assertSame("$tag John Reyes", $mine[1]['faculty']['full_name']);
        $this->assertSame($nurse->id, $mine[0]['dispenser']['id']);

        $this->assertSame(['Fever', 'Headache'], $reasons(''));
        // Days are clinic days: 11:30 PM on the 28th belongs to the 28th, 12:30 AM on the 29th to the 29th.
        $day = fn (string $from, string $to) => collect($this->getJson("/api/nurse/faculty-dispensings?from=$from&to=$to&per_page=100")->json('data.data'))
            ->filter(fn ($row) => str_starts_with($row['medicine_name'], $tag))->pluck('reason')->all();
        $this->assertSame(['Cold symptoms'], $day('2026-10-28', '2026-10-28'));
        $this->assertSame(['Fever'], $day('2026-10-29', '2026-10-29'));
        $this->assertSame(['Fever', 'Cold symptoms'], $day('2026-10-20', '2026-10-31'));
        $this->assertSame(['Headache'], $day('2026-10-01', '2026-10-27'));
        $this->assertSame(['Headache'], $reasons('&to=2026-10-27'));

        $page = $this->getJson("/api/nurse/faculty-dispensings?faculty_id=$maria->id&per_page=1&page=2")->assertOk();
        $page->assertJsonPath('data.total', 2)->assertJsonPath('data.last_page', 2)->assertJsonPath('data.data.0.reason', 'Headache');

        $show = $this->getJson("/api/nurse/faculty/{$maria->id}")->assertOk();
        $show->assertJsonPath('dispensing_count', 2)->assertJsonPath('recent_dispensings.0.reason', 'Fever');
    }

    public function test_only_nurses_can_use_the_faculty_pages(): void
    {
        $student = $this->person('student');
        $faculty = $this->faculty('FAC Guard Test');
        $this->actingAs($student, 'api');
        $this->getJson('/api/nurse/faculty')->assertForbidden();
        $this->postJson('/api/nurse/faculty', ['full_name' => 'X', 'faculty_type' => 'full_time', 'course' => 'BSIT'])->assertForbidden();
        $this->postJson("/api/nurse/faculty/{$faculty->id}/dispense", ['medicine_id' => (string) Str::uuid(), 'quantity' => 1, 'reason' => 'x'])->assertForbidden();
        $this->getJson('/api/nurse/faculty-dispensings')->assertForbidden();
    }
}
