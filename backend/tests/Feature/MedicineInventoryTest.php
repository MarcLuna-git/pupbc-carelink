<?php

namespace Tests\Feature;

use App\Models\Medicine;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/*
 * The medicine inventory page: the stock status filter, the brand/manufacturer field, the 200 character
 * notes, and the stock history with the stock before and after every movement.
 */
class MedicineInventoryTest extends TestCase
{
    use DatabaseTransactions;

    private function person(string $role): User
    {
        return User::create([
            'student_id' => 'INV-' . Str::random(10), 'first_name' => 'Inv', 'last_name' => ucfirst($role) . Str::random(4),
            'email' => Str::uuid() . '@example.test', 'password' => Hash::make('TestPassword123!'),
            'birthday' => '2002-05-15', 'role' => $role, 'status' => null,
        ]);
    }

    public function test_a_new_medicine_keeps_its_brand_and_notes_and_starts_its_stock_history(): void
    {
        $this->actingAs($this->person('nurse'), 'api');
        $tag = 'INV' . Str::upper(Str::random(6));
        $payload = [
            'name' => $tag . ' 500 mg', 'generic_name' => 'Acetaminophen', 'manufacturer' => 'Biogesic', 'category' => 'Pain Relief', 'unit' => 'tablet',
            'quantity' => 50, 'minimum_stock' => 10, 'dosage' => '1 tablet', 'expiry_date' => now()->addYear()->toDateString(), 'description' => 'Keep dry',
        ];

        $created = $this->postJson('/api/nurse/medicines', $payload)->assertCreated()->assertJsonPath('data.manufacturer', 'Biogesic');
        $id = $created->json('data.id');

        // The starting stock is the first line of the history: 0 -> 50.
        $this->getJson("/api/nurse/medicines/$id/movements")->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.movement_type', 'stock_in')
            ->assertJsonPath('data.data.0.quantity_change', 50)
            ->assertJsonPath('data.data.0.stock_before', 0)
            ->assertJsonPath('data.data.0.stock_after', 50)
            ->assertJsonPath('data.data.0.reason', 'Initial stock');

        // Notes stop at 200 characters, like the counter on the form.
        $this->postJson('/api/nurse/medicines', array_merge($payload, ['name' => $tag . ' B', 'description' => str_repeat('x', 201)]))->assertStatus(422);
        $this->postJson('/api/nurse/medicines', array_merge($payload, ['name' => $tag . ' C', 'description' => str_repeat('x', 200)]))->assertCreated();

        $this->putJson("/api/nurse/medicines/$id", ['manufacturer' => 'Unilab'], ['If-Match' => $created->json('data.sync_version')])
            ->assertOk()->assertJsonPath('data.manufacturer', 'Unilab');
    }

    public function test_the_stock_history_shows_the_change_and_the_stock_before_and_after(): void
    {
        $nurse = $this->person('nurse');
        $student = $this->person('student');
        $this->actingAs($nurse, 'api');
        $at = fn (string $time) => Carbon::setTestNow(Carbon::parse("2026-10-28 $time", 'Asia/Manila'));

        $at('09:00:00');
        $id = $this->postJson('/api/nurse/medicines', ['name' => 'HIST ' . Str::random(6), 'quantity' => 50, 'minimum_stock' => 10, 'unit' => 'tablet', 'expiry_date' => '2027-10-28'])->assertCreated()->json('data.id');
        $at('09:01:00');
        $this->postJson("/api/nurse/medicines/$id/add-stock", ['quantity' => 20, 'reason' => 'Supplier Delivery #SD-2026-1015'])->assertOk();
        $at('09:02:00');
        $version = fn () => Medicine::findOrFail($id)->sync_version;
        $this->postJson("/api/nurse/medicines/$id/movements", ['movement_type' => 'dispensed', 'quantity' => 30, 'reason' => 'Consultation', 'student_id' => $student->student_id], ['If-Match' => $version()])->assertOk();
        $at('09:03:00');
        $this->postJson("/api/nurse/medicines/$id/movements", ['movement_type' => 'adjustment', 'quantity' => 10, 'reason' => 'Damaged stock'], ['If-Match' => $version()])->assertOk();
        $this->assertSame(30, Medicine::findOrFail($id)->quantity);

        // Newest first; each line's "before" is the "after" of the line below it, ending at the stock on the shelf.
        $rows = $this->getJson("/api/nurse/medicines/$id/movements")->assertOk()->json('data.data');
        $this->assertSame(
            [['adjustment', -10, 40, 30], ['dispensed', -30, 70, 40], ['stock_in', 20, 50, 70], ['stock_in', 50, 0, 50]],
            array_map(fn ($row) => [$row['movement_type'], $row['quantity_change'], $row['stock_before'], $row['stock_after']], $rows)
        );
        $this->assertSame('Supplier Delivery #SD-2026-1015', $rows[2]['reason']);
        $this->assertSame($student->student_id, $rows[1]['student']['student_id']);

        // A filter chooses which lines to show; the balances still come from the whole history.
        $dispensed = $this->getJson("/api/nurse/medicines/$id/movements?type=dispensed")->assertOk();
        $dispensed->assertJsonPath('data.total', 1)->assertJsonPath('data.data.0.stock_before', 70)->assertJsonPath('data.data.0.stock_after', 40);

        $this->getJson("/api/nurse/medicines/$id/movements?from=2026-10-28&to=2026-10-28")->assertJsonPath('data.total', 4);
        $this->getJson("/api/nurse/medicines/$id/movements?from=2026-10-29")->assertJsonPath('data.total', 0);
        $this->getJson("/api/nurse/medicines/$id/movements?to=2026-10-27")->assertJsonPath('data.total', 0);
        $this->getJson("/api/nurse/medicines/$id/movements?type=nonsense")->assertStatus(422);

        // Pages for the table, everything for an export.
        $page = $this->getJson("/api/nurse/medicines/$id/movements?per_page=3&page=2")->assertOk();
        $page->assertJsonPath('data.total', 4)->assertJsonPath('data.last_page', 2)->assertJsonPath('data.from', 4);
        $this->assertCount(1, $page->json('data.data'));
        $this->assertCount(4, $this->getJson("/api/nurse/medicines/$id/movements?all=1")->json('data.data'));
    }

    public function test_the_stock_status_filter_matches_the_badge_on_every_row(): void
    {
        $this->actingAs($this->person('nurse'), 'api');
        $tag = 'STS' . Str::upper(Str::random(6));
        $make = fn (string $label, int $quantity, string $expiry, array $extra = []) => Medicine::create(array_merge([
            'name' => "$tag $label", 'quantity' => $quantity, 'minimum_stock' => 10, 'unit' => 'tablet', 'expiry_date' => $expiry,
        ], $extra));
        $far = now()->addYear()->toDateString();
        $make('Fine', 100, $far, ['category' => 'Pain Relief', 'manufacturer' => 'Acme']);
        $make('Low', 5, $far, ['category' => 'Pain Relief']);
        $make('Out', 0, $far, ['category' => 'Vitamins']);
        $make('Expired', 50, now()->subDay()->toDateString());
        $make('ExpiredEmpty', 0, now()->subDay()->toDateString());
        $make('Soon', 50, now()->addMonth()->toDateString());

        $names = fn (string $query) => collect($this->getJson("/api/nurse/medicines?search=$tag$query")->assertOk()->json('data.data'))
            ->map(fn ($row) => str_replace("$tag ", '', $row['name']))->sort()->values()->all();

        // Each row has one status, the strongest that applies.
        $status = collect($this->getJson("/api/nurse/medicines?search=$tag")->json('data.data'))
            ->mapWithKeys(fn ($row) => [str_replace("$tag ", '', $row['name']) => $row['status']])->all();
        $this->assertSame(['Expired' => 'expired', 'ExpiredEmpty' => 'expired', 'Fine' => 'ok', 'Low' => 'low_stock', 'Out' => 'out_of_stock', 'Soon' => 'expiring_soon'], collect($status)->sortKeys()->all());

        $this->assertSame(['Fine'], $names('&status=in_stock'));
        $this->assertSame(['Low'], $names('&status=low_stock'));
        $this->assertSame(['Out'], $names('&status=out_of_stock'));
        $this->assertSame(['Soon'], $names('&status=expiring_soon'));
        $this->assertSame(['Expired', 'ExpiredEmpty'], $names('&status=expired'));
        $this->assertCount(6, $names(''));

        // Category, brand search and page size.
        $this->assertSame(['Fine', 'Low'], $names('&category=' . urlencode('Pain Relief')));
        $this->assertSame(['Fine'], $names('&status=in_stock&category=' . urlencode('Pain Relief')));
        $this->assertSame(['Fine'], collect($this->getJson('/api/nurse/medicines?search=Acme')->json('data.data'))->filter(fn ($row) => str_starts_with($row['name'], $tag))->map(fn ($row) => str_replace("$tag ", '', $row['name']))->values()->all());
        $paged = $this->getJson("/api/nurse/medicines?search=$tag&per_page=2")->assertOk();
        $paged->assertJsonPath('data.per_page', 2)->assertJsonPath('data.total', 6)->assertJsonPath('data.last_page', 3);
    }
}
