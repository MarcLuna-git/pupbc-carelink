<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\HealthProfile;
use App\Models\QRCode;
use App\Models\StudentProfile;
use App\Services\NurseSync;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/*
 * "Reset data" — clears everything the student typed in from inside the portal
 * in one shot. Reached from Settings → General, and confirmed with the account
 * password.
 *
 * Cleared (the student's own input):
 *   - appointments, and by cascade their check-ins and visit triage;
 *   - nurse_visit_claims for those check-ins (no foreign key, so deleted here);
 *   - qr_codes — the QR / queue trail;
 *   - the profile details the student filled in (mobile, address, guardian,
 *     avatar) plus the mirrored users.mobile_number;
 *   - health_profiles — the 6-step health profile, so onboarding starts over.
 *
 * Never touched:
 *   - the account itself: name, email, password, student id, course/year/
 *     section, birthday, gender, role, status;
 *   - clinic-owned records: consultations, emergency_encounters, audit logs,
 *     notifications.
 */
class DataResetController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'password' => ['required', 'string'],
        ]);

        $user = auth()->user();

        if (! Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages([
                'password' => ['Your current password is incorrect.'],
            ]);
        }

        $counts = DB::transaction(function () use ($user) {
            // Visit claims hang off the check-in with no foreign key of their
            // own, so they have to be cleared before the cascade runs.
            $checkinIds = DB::table('appointment_checkins')
                ->where('user_id', $user->id)
                ->pluck('id');

            if ($checkinIds->isNotEmpty()) {
                DB::table('nurse_visit_claims')
                    ->whereIn('checkin_id', $checkinIds)
                    ->delete();
            }

            $qrCodes = QRCode::where('user_id', $user->id)->delete();

            // A reset must not leave soft-deleted rows behind for the clinic
            // lists, so delete the appointments outright.
            $appointments = DB::table('appointments')
                ->where('user_id', $user->id)
                ->delete();

            // Only the fields the student filled in. course/year/section,
            // birthday and gender came from registration and stay on the row.
            $profile = StudentProfile::where('user_id', $user->id)->first();

            if ($profile) {
                if ($profile->profile_picture) {
                    Storage::disk('public')->delete($profile->profile_picture);
                }

                $profile->update([
                    'mobile_number' => null,
                    'address' => null,
                    'guardian_name' => null,
                    'guardian_relationship' => null,
                    'guardian_contact' => null,
                    'profile_picture' => null,
                ]);
            }

            $user->update(['mobile_number' => null]);

            $healthProfile = HealthProfile::where('user_id', $user->id)->delete();

            return [
                'appointments' => $appointments,
                'qr_codes' => $qrCodes,
                'health_profile' => $healthProfile > 0,
            ];
        });

        // The mass deletes above skip the model events that normally keep the
        // nurse dashboards in sync, so bump the affected topics by hand.
        NurseSync::changed('appointments');
        NurseSync::changed('queue');
        NurseSync::changed('students');

        return response()->json([
            'success' => true,
            'message' => 'Your data has been reset. Your account is unchanged.',
            'data' => $counts,
        ]);
    }
}
