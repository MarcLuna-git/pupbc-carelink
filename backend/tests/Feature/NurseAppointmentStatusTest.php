<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/*
 * The nurse Appointments page lists booking requests only: pending, approved, declined,
 * cancelled and expired. Queue and consultation progress belongs to the Consultation page.
 */
class NurseAppointmentStatusTest extends TestCase
{
    use DatabaseTransactions;

    private function person(string $role, string $studentId): User
    {
        return User::create([
            'student_id' => $studentId, 'first_name' => 'Status', 'last_name' => ucfirst($role) . Str::random(4),
            'email' => Str::uuid() . '@example.test', 'password' => Hash::make('TestPassword123!'),
            'birthday' => '2002-05-15', 'role' => $role, 'status' => null,
        ]);
    }

    private function book(User $student, string $status, bool $noShow = false): Appointment
    {
        $appointment = Appointment::create([
            'user_id' => $student->id, 'service' => 'Consultation', 'time_slot' => '9:00 AM',
            'appointment_date' => Carbon::tomorrow('Asia/Manila')->toDateString(), 'status' => $status,
        ]);
        if ($noShow) {
            $appointment->forceFill(['no_show' => true])->save();
        }

        return $appointment;
    }

    public function test_tabs_and_counts_follow_the_request_status_only(): void
    {
        $key = 'STS-' . Str::random(8);
        $student = $this->person('student', $key);
        $this->actingAs($this->person('nurse', 'STSN-' . Str::random(8)), 'api');

        $pending = $this->book($student, 'pending');
        $approved = $this->book($student, 'approved');
        $completed = $this->book($student, 'completed');
        $declined = $this->book($student, 'rejected');
        $cancelled = $this->book($student, 'cancelled');
        $expired = $this->book($student, 'expired');
        $noShow = $this->book($student, 'approved', true);

        $counts = $this->getJson('/api/nurse/appointments?search=' . $key)->assertOk()->json('counts');
        $this->assertSame(
            ['all' => 7, 'pending' => 1, 'approved' => 2, 'rejected' => 1, 'cancelled' => 1, 'expired' => 2],
            array_intersect_key($counts, array_flip(['all', 'pending', 'approved', 'rejected', 'cancelled', 'expired']))
        );
        // Queue stages are not tabs here any more.
        foreach (['waiting', 'in_consultation', 'completed'] as $gone) {
            $this->assertArrayNotHasKey($gone, $counts);
        }

        $ids = fn(string $status) => collect($this->getJson('/api/nurse/appointments?per_page=50&search=' . $key . '&status=' . $status)
            ->assertOk()->json('data.data'))->pluck('id')->sort()->values()->all();
        $sorted = fn(array $list) => collect($list)->pluck('id')->sort()->values()->all();

        $this->assertSame([$pending->id], $ids('pending'));
        // A finished visit is still an approved booking here; a no-show is not.
        $this->assertSame($sorted([$approved, $completed]), $ids('approved'));
        $this->assertSame([$declined->id], $ids('rejected'));
        $this->assertSame([$cancelled->id], $ids('cancelled'));
        $this->assertSame($sorted([$expired, $noShow]), $ids('expired'));
    }
}
