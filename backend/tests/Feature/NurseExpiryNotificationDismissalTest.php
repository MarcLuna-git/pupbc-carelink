<?php

namespace Tests\Feature;

use App\Models\Medicine;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

class NurseExpiryNotificationDismissalTest extends TestCase
{
    use DatabaseTransactions;

    private function nurse(): User
    {
        return User::create([
            'first_name' => 'Expiry', 'last_name' => 'Test',
            'email' => Str::uuid() . '@example.test', 'password' => 'unused', 'role' => 'nurse',
        ]);
    }

    private function medicine(): Medicine
    {
        return Medicine::create([
            'name' => 'Expiry fixture ' . Str::uuid(), 'quantity' => 10, 'minimum_stock' => 1,
            'expiry_date' => today('Asia/Manila')->addMonth()->toDateString(),
        ]);
    }

    private function expiry(User $nurse, Medicine $medicine)
    {
        return Notification::where('user_id', $nurse->id)->where('type', 'medicine_expiring_soon')
            ->where('data->medicine_id', $medicine->id);
    }

    public function test_expiry_dismissal_survives_polling_and_scheduled_generation(): void
    {
        $nurse = $this->nurse();
        $medicine = $this->medicine();
        $initial = $this->actingAs($nurse, 'api')->getJson('/api/notifications')->assertOk();
        $notification = $this->expiry($nurse, $medicine)->firstOrFail();
        $this->assertFalse($notification->read);
        $originalData = $notification->data;
        $unread = $initial->json('unread_count');

        $this->deleteJson('/api/notifications/' . $notification->id)->assertOk()
            ->assertJsonPath('unread_count', $unread - 1);
        $dismissed = $notification->fresh();
        $this->assertNotNull($dismissed);
        $this->assertTrue($dismissed->data['dismissed']);
        $this->assertTrue($dismissed->read);
        $this->assertNotNull($dismissed->read_at);
        $this->assertSame($originalData['medicine_id'], $dismissed->data['medicine_id']);
        $this->assertSame($originalData['expiry_date'], $dismissed->data['expiry_date']);

        for ($poll = 0; $poll < 2; $poll++) {
            $this->getJson('/api/notifications')->assertOk()
                ->assertJsonPath('unread_count', $unread - 1)
                ->assertJsonMissing(['id' => $notification->id]);
            $this->assertSame(1, $this->expiry($nurse, $medicine)->count());
        }
        $this->artisan('medicines:notify-expiring')->assertExitCode(0);
        $this->getJson('/api/notifications')->assertOk()
            ->assertJsonPath('unread_count', $unread - 1)
            ->assertJsonMissing(['id' => $notification->id]);
        $this->assertSame(1, $this->expiry($nurse, $medicine)->count());

        // Dismissing an already dismissed notification remains harmless.
        $this->deleteJson('/api/notifications/' . $notification->id)->assertOk()
            ->assertJsonPath('unread_count', $unread - 1);
    }

    public function test_dismissal_is_independent_per_medicine_and_nurse(): void
    {
        $firstNurse = $this->nurse();
        $secondNurse = $this->nurse();
        $firstMedicine = $this->medicine();
        $this->actingAs($firstNurse, 'api')->getJson('/api/notifications')->assertOk();
        $dismissed = $this->expiry($firstNurse, $firstMedicine)->firstOrFail();
        $this->deleteJson('/api/notifications/' . $dismissed->id)->assertOk();

        $secondMedicine = $this->medicine();
        $this->getJson('/api/notifications')->assertOk()->assertJsonMissing(['id' => $dismissed->id]);
        $this->assertFalse($this->expiry($firstNurse, $secondMedicine)->firstOrFail()->read);
        $this->actingAs($secondNurse, 'api')->getJson('/api/notifications')->assertOk();
        $secondAlert = $this->expiry($secondNurse, $firstMedicine)->firstOrFail();
        $this->assertFalse($secondAlert->read);
        $this->assertArrayNotHasKey('dismissed', $secondAlert->data);
        $this->deleteJson('/api/notifications/' . $dismissed->id)->assertNotFound();

        $this->artisan('medicines:notify-expiring')->assertExitCode(0);
        foreach ([$firstNurse, $secondNurse] as $nurse) {
            foreach ([$firstMedicine, $secondMedicine] as $medicine) {
                $this->assertSame(1, $this->expiry($nurse, $medicine)->count());
            }
        }
        $this->assertTrue($dismissed->fresh()->data['dismissed']);
    }

    public function test_normal_notifications_still_delete_physically(): void
    {
        $nurse = $this->nurse();
        $normal = Notification::create([
            'user_id' => $nurse->id, 'type' => 'appointment_booked',
            'title' => 'Normal fixture', 'message' => 'Normal notification',
            'data' => ['dismissed' => true], 'read' => false,
        ]);
        $initial = $this->actingAs($nurse, 'api')->getJson('/api/notifications')->assertOk();
        $this->assertContains($normal->id, array_column($initial->json('data.data'), 'id'));
        $this->deleteJson('/api/notifications/' . $normal->id)->assertOk()
            ->assertJsonPath('unread_count', $initial->json('unread_count') - 1);
        $this->assertNull($normal->fresh());
        $this->getJson('/api/notifications')->assertOk()->assertJsonMissing(['id' => $normal->id]);
    }
}
