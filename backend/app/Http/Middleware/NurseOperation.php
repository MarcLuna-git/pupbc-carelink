<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use App\Services\ClinicQueue;

class NurseOperation
{
    public function handle(Request $request, Closure $next)
    {
        if (optional($request->user())->role !== 'nurse') {
            return $next($request);
        }
        if ($request->is('api/nurse/queue/*', 'api/nurse/sync', 'api/nurse/consultations', 'api/nurse/consultations/*')) {
            // Commit deadline reconciliation before a stale action can fail and
            // roll back its own transaction. Sync polls work without queue UI.
            app(\App\Services\SkippedQueueExpiry::class)->run();
        }
        if ($request->isMethodSafe()) {
            if ($request->is('api/notifications')) {
                // The existing notification GET generates expiry alerts on demand.
                return DB::transaction(function () use ($request, $next) {
                    ClinicQueue::lock();
                    return $next($request);
                }, 3);
            }
            return $next($request);
        }

        return DB::transaction(function () use ($request, $next) {
            // Use the existing clinic mutex first, preserving queue lock order across devices.
            ClinicQueue::lock();
            $key = $request->header('Idempotency-Key');
            abort_if($key !== null && !preg_match('/^[a-zA-Z0-9-]{16,80}$/', $key), 422, 'Invalid operation key.');
            $operation = $key ? hash('sha256', $request->user()->id . ':' . $key) : null;
            $hash = hash('sha256', $request->method() . $request->path() . json_encode($request->all()));
            if ($operation && ($saved = DB::table('nurse_operations')->where('operation_key', $operation)->first())) {
                abort_unless(hash_equals($saved->request_hash, $hash), 409, 'This operation key was already used for different data.');
                return response(Crypt::decryptString($saved->response), $saved->status)->header('Content-Type', 'application/json');
            }

            $this->checkVersion($request);
            $response = $next($request);
            // Laravel may render a controller exception into a response inside $next.
            // Roll back that response too, rather than committing a partially completed operation.
            if (!$response->isSuccessful()) {
                throw new \Illuminate\Http\Exceptions\HttpResponseException($response);
            }
            if ($response->isSuccessful()) {
                if ($request->is('api/notifications/*')) {
                    \App\Services\NurseSync::changed('notifications'); // Bulk read updates bypass model events.
                }
                if ($operation) {
                    DB::table('nurse_operations')->insert([
                        'operation_key' => $operation, 'request_hash' => $hash,
                        'status' => $response->getStatusCode(),
                        'response' => Crypt::encryptString($response->getContent()), 'created_at' => now(),
                    ]);
                }
            }
            return $response;
        }, 3);
    }

    private function checkVersion(Request $request): void
    {
        if ($request->is('api/nurse/queue/*') && $request->isMethod('POST') &&
            in_array($request->segment(5), ['skip', 'returned', 'arrived', 'recall'], true)) {
            if (in_array($request->segment(5), ['skip', 'returned'], true) || $request->header('If-Match')) {
                $checkin = \App\Models\AppointmentCheckin::lockForUpdate()->findOrFail($request->route('id'));
                $this->assertVersion($request, $checkin->sync_version);
            }
            return;
        }
        if ($request->is('api/nurse/profile')) {
            $model = \App\Models\User::lockForUpdate()->findOrFail($request->user()->id);
            $this->assertVersion($request, $model->sync_version);
            return;
        }
        if ($request->is('api/nurse/students/*/medical-record')) {
            // Student self-service edits lock this same user row before saving the health profile.
            \App\Models\User::lockForUpdate()->findOrFail($request->route('id'));
            $profile = \App\Models\HealthProfile::where('user_id', $request->route('id'))->first();
            $this->assertVersion($request, $profile ? $profile->sync_version : 'new');
            return;
        }
        if ($request->is('api/nurse/appointments/*/reschedule')) {
            $model = \App\Models\Appointment::lockForUpdate()->findOrFail($request->route('id'));
            $this->assertVersion($request, $model->sync_version);
            return;
        }
        $models = [
            'medicines' => \App\Models\Medicine::class,
            'consultations' => \App\Models\Consultation::class,
            'announcements' => \App\Models\Announcement::class,
            'academic-periods' => \App\Models\AcademicPeriod::class,
            'courses' => \App\Models\Course::class,
            'course-sections' => \App\Models\CourseSection::class,
        ];
        $resource = $request->segment(3);
        $id = $request->route('id');
        if (!$id || !isset($models[$resource])) return;
        // Additive stock receipts commute. Deductions must use the stock snapshot the nurse saw.
        if ($request->isMethod('POST') && !in_array($request->segment(5), ['movements', 'reduce-stock'], true)) return;
        $model = $models[$resource]::lockForUpdate()->findOrFail($id);
        $this->assertVersion($request, $model->sync_version);
    }

    private function assertVersion(Request $request, string $current): void
    {
        $version = $request->header('If-Match');
        abort_unless($version, 428, 'Reopen this record before saving; its version is required.');
        abort_unless(hash_equals($current, trim($version, '"')), 409,
            'This record was changed on another device. Your inputs are preserved. Reopen the latest record and review your changes before saving again.');
    }
}
