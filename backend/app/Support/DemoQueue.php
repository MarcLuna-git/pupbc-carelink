<?php

namespace App\Support;

use App\Models\Appointment;
use App\Models\AppointmentCheckin;
use App\Models\Consultation;
use App\Models\User;
use App\Services\ClinicQueue;
use App\Services\NurseSync;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/*
 * Consultation → Queue list → Options → Developer tools → Demo patients.
 * Fake students who loop through the queue: waiting → called → in consultation →
 * saved (print form) → back to waiting. One patient per triage level (HIGH, MEDIUM, LOW), so
 * the queue order (Priority → Medium → Regular) and the priority lane can be checked.
 * They get real queue numbers from ClinicQueue::allocate (a new one each loop), like any student.
 * Clinic-wide switch kept in
 * clinic_settings. Turning it off deletes the demo students and everything recorded for them.
 */
class DemoQueue
{
    public const SETTING = 'demo_queue';

    public const PATIENTS = [
        [
            'email' => 'demo.patient@carelink.dev', 'student_id' => '2025-09003-BN-0',
            'profile' => ['birthday' => '2006-03-14', 'address' => 'Blk 5 Lot 12, Sampaguita St., Brgy. Zapote, Biñan City, Laguna', 'mobile_number' => '09171230003', 'guardian_name' => 'Maria Patient', 'guardian_relationship' => 'Mother', 'guardian_contact' => '09181230003'],
            'first_name' => 'Demo', 'last_name' => 'Patient',
            'queue_type' => 'regular', 'priority' => 'LOW',
            'complaint' => 'Headache (demo)', 'severity' => 'mild', 'pain_level' => 3, 'red_flags' => ['none'],
        ],
        [
            'email' => 'demo.priority@carelink.dev', 'student_id' => '2025-09001-BN-0',
            'profile' => ['birthday' => '2005-09-21', 'address' => 'Blk 2 Lot 8, Rosal St., Brgy. Canlalay, Biñan City, Laguna', 'mobile_number' => '09171230001', 'guardian_name' => 'Rosa Priority', 'guardian_relationship' => 'Mother', 'guardian_contact' => '09181230001'],
            'first_name' => 'Demo', 'last_name' => 'Priority',
            'queue_type' => 'priority', 'priority' => 'HIGH',
            'complaint' => 'Chest pain and difficulty breathing (demo)', 'severity' => 'severe', 'pain_level' => 8,
            'red_flags' => ['severe_chest_pain', 'difficulty_breathing'],
        ],
        [
            'email' => 'demo.medium@carelink.dev', 'student_id' => '2025-09002-BN-0',
            'profile' => ['birthday' => '2006-01-30', 'address' => 'Blk 9 Lot 3, Orchid St., Brgy. San Antonio, Biñan City, Laguna', 'mobile_number' => '09171230002', 'guardian_name' => 'Jose Medium', 'guardian_relationship' => 'Father', 'guardian_contact' => '09181230002'],
            'first_name' => 'Demo', 'last_name' => 'Medium',
            'queue_type' => 'regular', 'priority' => 'MEDIUM',
            'complaint' => 'Fever and body pain (demo)', 'severity' => 'moderate', 'pain_level' => 5,
            'red_flags' => ['none'],
        ],
    ];

    // Visits still in the queue; anything else (completed, no-show) loops back to waiting.
    private const ACTIVE = ['waiting', 'called', 'serving', 'skipped', 'on_hold'];

    private static ?bool $enabledMemo = null;

    public static function enabled(): bool
    {
        if (!config('dev_tools.enabled')) return false;
        if (self::$enabledMemo !== null) return self::$enabledMemo;
        return self::$enabledMemo = DB::table('clinic_settings')->where('key', self::SETTING)->value('value') === '1';
    }

    /** @return string[] ids of the demo students that exist */
    public static function userIds(): array
    {
        return User::withTrashed()->whereIn('email', array_column(self::PATIENTS, 'email'))->pluck('id')->all();
    }

    public static function studentIds(): array
    {
        return array_column(self::PATIENTS, 'student_id');
    }

    public static function isDemoStudentId(?string $studentId): bool
    {
        return $studentId !== null && in_array($studentId, self::studentIds(), true);
    }

    public static function set(bool $on, ?string $nurseId): void
    {
        $values = ['value' => $on ? '1' : '0', 'updated_by' => $nurseId, 'updated_at' => now()];
        if (!DB::table('clinic_settings')->where('key', self::SETTING)->update($values)) {
            DB::table('clinic_settings')->insert($values + ['key' => self::SETTING, 'created_at' => now()]);
        }
        self::$enabledMemo = $on;
        $on ? self::reset($nurseId) : self::remove();
    }

    /* Called on every nurse queue load: puts each demo patient back in line once their visit ends. */
    public static function ensure(): void
    {
        if (!self::enabled()) return;
        $ids = User::whereIn('email', array_column(self::PATIENTS, 'email'))->pluck('id', 'email');
        $missing = array_filter(self::PATIENTS, fn ($p) => !isset($ids[$p['email']]) || !self::activeVisit($ids[$p['email']])->exists());
        if ($missing) self::reset(null, $missing);
    }

    /* Start over: one fresh waiting visit per demo patient, nothing else on record. */
    public static function reset(?string $nurseId, ?array $patients = null): void
    {
        DB::transaction(function () use ($nurseId, $patients) {
            ClinicQueue::lock();
            // Seed in call order, so the numbers read naturally (Medium gets a lower R- number than Regular).
            $patients = $patients ?? self::PATIENTS;
            usort($patients, fn ($a, $b) => array_search($a['priority'], ['HIGH', 'MEDIUM', 'LOW']) <=> array_search($b['priority'], ['HIGH', 'MEDIUM', 'LOW']));
            foreach ($patients as $patient) {
                $user = self::user($patient);
                self::purge($user->id);
                self::seed($user, $patient, $nurseId);
            }
        }, 3);
        Cache::forget('nurse_dashboard_stats');
        NurseSync::changed('queue');
    }

    /* Switch off: the demo students and all their records are deleted. */
    public static function remove(): void
    {
        $userIds = self::userIds();
        if (!$userIds) return;
        DB::transaction(function () use ($userIds) {
            ClinicQueue::lock();
            foreach ($userIds as $userId) {
                self::purge($userId);
                User::withTrashed()->whereKey($userId)->forceDelete(); // profiles, notifications… cascade
            }
        }, 3);
        Cache::forget('nurse_dashboard_stats');
        NurseSync::changed('queue');
    }

    private static function activeVisit(string $userId)
    {
        return AppointmentCheckin::where('user_id', $userId)
            ->where('created_at', '>=', today())->where('created_at', '<', today()->addDay())
            ->whereIn('status', self::ACTIVE);
    }

    private static function user(array $patient): User
    {
        $user = User::withTrashed()->where('email', $patient['email'])->first();
        if ($user) {
            if ($user->trashed()) $user->restore();
            self::fillProfile($user, $patient);
            // Demo students made before the IDs changed get the current one.
            if ($user->student_id !== $patient['student_id']) $user->forceFill(['student_id' => $patient['student_id']])->save();
            return $user;
        }
        $user = User::forceCreate([
            'id' => (string) Str::uuid(),
            'student_id' => $patient['student_id'],
            'first_name' => $patient['first_name'],
            'last_name' => $patient['last_name'],
            'email' => $patient['email'],
            'role' => 'student',
            'password' => Hash::make(Str::random(40)), // nobody signs in as a demo patient
            'gender' => 'other',
            'course' => 'BSIT',
            'year' => '1st Year',
            'section' => '1',
            'email_verified_at' => now(),
        ]);
        self::fillProfile($user, $patient);
        return $user;
    }

    /* Details a real student gives when registering (birthday, address, contacts), so the consultation form prefills. */
    private static function fillProfile(User $user, array $patient): void
    {
        $user->studentProfile()->updateOrCreate([], ['course' => 'BSIT', 'year' => '1st Year', 'section' => '1', 'gender' => 'other'] + $patient['profile']);
    }

    private static function purge(string $userId): void
    {
        $checkinIds = AppointmentCheckin::where('user_id', $userId)->pluck('id');
        DB::table('nurse_visit_claims')->whereIn('checkin_id', $checkinIds)->delete();
        foreach ($checkinIds as $id) {
            DB::table('audit_logs')->where('description', 'like', '%' . $id . '%')->delete();
        }
        Consultation::withTrashed()->where('user_id', $userId)->forceDelete();
        // Check-ins, triage and consultation drafts go with the appointments (cascade).
        Appointment::withTrashed()->where('user_id', $userId)->forceDelete();
        AppointmentCheckin::where('user_id', $userId)->delete();
        DB::table('notifications')->where('user_id', $userId)->delete();
    }

    private static function slotNow(): string
    {
        $now = now('Asia/Manila');
        return $now->copy()->setTime($now->hour, intdiv($now->minute, 15) * 15)->format('g:i A');
    }

    private static function seed(User $user, array $patient, ?string $nurseId): void
    {
        $appointment = Appointment::create([
            'user_id' => $user->id,
            'service' => 'Consultation',
            'appointment_date' => today()->toDateString(),
            // Slot = now (to the quarter hour). A morning slot would already be past its check-in
            // deadline, so a skipped demo patient would turn No-show at once and vanish from the list.
            'time_slot' => self::slotNow(),
            'concern' => 'Demo patient (Developer tools)',
            'status' => 'approved',
            'approved_by' => $nurseId,
            'approved_at' => now(),
        ]);
        $number = ClinicQueue::allocate($patient['queue_type']);
        $checkin = AppointmentCheckin::create([
            'appointment_id' => $appointment->id, 'user_id' => $user->id,
            'queue_number' => $number, 'queue_type' => $patient['queue_type'], 'is_walk_in' => false,
            'triage_reason' => $patient['complaint'], 'chief_complaint' => $patient['complaint'], 'checkin_status' => 'confirmed',
            'checked_in_at' => now(), 'check_in_time' => now(), 'status' => 'waiting',
        ]);
        $checkin->triage()->create([
            'chief_complaint' => $patient['complaint'], 'symptom_duration' => 'Today', 'severity' => $patient['severity'],
            'pain_level' => $patient['pain_level'], 'red_flags' => $patient['red_flags'],
            'notes' => 'Demo patient from Developer tools.', 'priority' => $patient['priority'],
        ]);
        $appointment->forceFill([
            'checked_in_at' => now(), 'queue_number' => $number, 'queue_type' => $patient['queue_type'],
        ])->save();
    }
}
