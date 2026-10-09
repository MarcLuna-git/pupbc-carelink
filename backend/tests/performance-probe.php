<?php
// Synthetic, process-local SQLite only. Never connects to a configured clinical database.
foreach (['APP_ENV' => 'testing', 'DB_CONNECTION' => 'mysql', 'DB_HOST' => '127.0.0.1',
    'DB_PORT' => '3307', 'DB_DATABASE' => 'carelink_stability_testing', 'DB_SOCKET' => '', 'DATABASE_URL' => ''] as $key => $value) {
    putenv($key . '=' . $value);
    $_ENV[$key] = $_SERVER[$key] = $value;
}
require __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/Feature/NurseSyncTest.php';

use App\Models\{User, Appointment, AppointmentCheckin, Consultation, Notification};
use Illuminate\Support\Facades\{DB, Cache, Schema};
use Illuminate\Http\Request;
use Carbon\Carbon;

class PerformanceFixture extends \Tests\Feature\NurseSyncTest
{
    public function start(): void { $this->setUp(); }
    public function finish(): void { $this->tearDown(); }
}

$fixture = new PerformanceFixture();
$fixture->start();
if (DB::connection()->getDriverName() !== 'sqlite' || DB::connection()->getDatabaseName() !== ':memory:') {
    throw new RuntimeException('Performance probe must use isolated in-memory SQLite.');
}
config(['cache.default' => 'array', 'app.timezone' => 'Asia/Manila']);
Carbon::setTestNow(Carbon::parse('2026-10-12 08:00:00', 'Asia/Manila'));
$nurse = User::create(['first_name' => 'Synthetic', 'last_name' => 'Nurse', 'email' => 'nurse@example.test', 'password' => 'unused', 'role' => 'nurse']);
$student = User::create(['first_name' => 'Synthetic', 'last_name' => 'Student', 'student_id' => 'PERF-001', 'email' => 'student@example.test', 'password' => 'unused', 'role' => 'student']);
for ($i = 0; $i < 500; $i++) {
    $appointment = Appointment::create(['user_id' => $student->id, 'service' => 'Synthetic visit',
        'appointment_date' => $i < 200 ? today()->toDateString() : today()->addDay()->toDateString(),
        'time_slot' => $i % 2 ? '9:00 AM' : '4:30 PM', 'status' => $i % 3 ? 'approved' : 'pending']);
    if ($i < 100) {
        $checkin = AppointmentCheckin::create(['appointment_id' => $appointment->id, 'user_id' => $student->id,
            'checked_in_at' => now(), 'check_in_time' => now(), 'status' => 'waiting', 'queue_number' => 'R-' . $i]);
        $checkin->triage()->create(['priority' => 'LOW', 'severity' => 'mild', 'chief_complaint' => 'Synthetic']);
    }
    if ($i < 50) Consultation::create(['appointment_id' => $appointment->id, 'user_id' => $student->id,
        'nurse_id' => $nurse->id, 'chief_complaint' => 'Synthetic', 'status' => 'completed']);
    if ($i < 100) Notification::create(['user_id' => $student->id, 'type' => 'appointment_approved', 'title' => 'Synthetic', 'message' => 'Synthetic']);
}

$optimized = in_array('--optimized', $argv, true);
$plans = [];
if ($optimized) {
    $explain = function () {
        return [
            'visit_lookup' => DB::select("EXPLAIN QUERY PLAN SELECT id FROM appointment_checkins WHERE appointment_id = 'synthetic' AND is_walk_in = 0"),
            'active_queue' => DB::select("EXPLAIN QUERY PLAN SELECT id FROM appointment_checkins WHERE is_walk_in = 0 AND status IN ('waiting','serving') AND created_at >= '2026-10-12' AND created_at < '2026-10-13'"),
            'notifications' => DB::select("EXPLAIN QUERY PLAN SELECT id FROM notifications WHERE user_id = 'synthetic' ORDER BY created_at DESC LIMIT 20"),
        ];
    };
    $plans['before_indexes'] = $explain();
    (require database_path('migrations/2026_10_10_000001_add_clinic_read_indexes.php'))->up();
    $plans['after_indexes'] = $explain();
}
$dashboard = app(\App\Http\Controllers\Api\Nurse\DashboardController::class);
$notifications = app(\App\Http\Controllers\Api\Student\NotificationController::class);
$kiosk = app(\App\Http\Controllers\Api\Kiosk\KioskController::class);
$scenarios = [
    'availability_16_slots' => function () { return \App\Models\AppointmentSlot::getAvailableSlots(today()->addDay()->toDateString()); },
    'nurse_dashboard_uncached' => function () use ($fixture, $nurse, $dashboard, $optimized) {
        $fixture->actingAs($nurse, 'api'); Cache::flush();
        $data = [$dashboard->stats()->getData(true)];
        if (!$optimized) { $data[] = $dashboard->appointmentsToday()->getData(true); $data[] = $dashboard->recentActivity()->getData(true); }
        return $data;
    },
    'nurse_dashboard_cached' => function () use ($fixture, $nurse, $dashboard, $optimized) {
        $fixture->actingAs($nurse, 'api');
        $data = [$dashboard->stats()->getData(true)];
        if (!$optimized) { $data[] = $dashboard->appointmentsToday()->getData(true); $data[] = $dashboard->recentActivity()->getData(true); }
        return $data;
    },
    'student_unread_badge' => function () use ($fixture, $student, $notifications, $optimized) {
        $fixture->actingAs($student, 'api');
        return ($optimized ? $notifications->unreadCount() : $notifications->index(Request::create('/api/student/notifications', 'GET', ['limit' => 1])))->getData(true);
    },
    'kiosk_queue_100_waiting' => function () use ($kiosk) { return $kiosk->todayQueue(Request::create('/api/kiosk/queue'))->getData(true); },
];

$results = ['environment' => ['database' => 'SQLite :memory:', 'php' => PHP_VERSION, 'samples' => 30,
    'fixture' => '500 appointments, 100 queue entries/triage, 50 consultations, 100 notifications',
    'scope' => 'in-process controller/model work; excludes HTTP, JWT, network, Render and PostgreSQL'], 'mode' => $optimized ? 'after' : 'before', 'index_plans' => $plans, 'scenarios' => []];
foreach ($scenarios as $name => $run) {
    $run(); // Warm autoload and query compilation before measuring.
    $times = []; $counts = []; $databaseTimes = []; $bytes = [];
    for ($i = 0; $i < 30; $i++) {
        DB::flushQueryLog(); DB::enableQueryLog();
        $started = microtime(true); $response = $run();
        $times[] = (microtime(true) - $started) * 1000;
        $queries = DB::getQueryLog(); DB::disableQueryLog();
        $counts[] = count($queries); $databaseTimes[] = array_sum(array_column($queries, 'time'));
        $bytes[] = strlen(json_encode($response));
    }
    sort($times); sort($databaseTimes);
    $results['scenarios'][$name] = ['median_ms' => round(($times[14] + $times[15]) / 2, 3),
        'p95_ms' => round($times[28], 3), 'query_count_min' => min($counts), 'query_count_max' => max($counts),
        'database_median_ms' => round(($databaseTimes[14] + $databaseTimes[15]) / 2, 3), 'response_bytes' => max($bytes)];
}
Carbon::setTestNow();
$fixture->finish();
$json = json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
foreach ($argv as $argument) if (strpos($argument, '--output=') === 0) file_put_contents(substr($argument, 9), $json);
echo $json;
