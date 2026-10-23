<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\StudentProfile;
use App\Services\AvatarStore;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    public function show()
    {
        $user = auth()->user()->load('profile');
        $profile = $this->profileData($user->profile);

        return response()->json([
            'success' => true,
            'data' => [
                'user' => $user,
                'profile' => $profile,
                'emergency_contact' => $this->emergencyContact($user),
            ],
        ]);
    }

    public function update(Request $request)
    {
        $user = auth()->user()->load('profile', 'healthProfile');

        $data = $request->validate([
            'mobile_number' => ['required', 'string', 'max:20', 'regex:/^(?:09\d{9}|\+639\d{9})$/'],
            'address' => 'nullable|string|max:1000',
            'guardian_name' => ['nullable', 'string', 'max:255', 'regex:/^[\pL\s\-\'.]+$/u'],
            'guardian_relationship' => 'nullable|string|max:100',
            'guardian_contact' => ['nullable', 'string', 'max:20', 'regex:/^(?:09\d{9}|\+639\d{9})$/'],
        ], [
            'mobile_number.required' => 'Mobile number is required.',
            'mobile_number.regex' => 'Use 09XXXXXXXXX or +639XXXXXXXXX for your mobile number.',
            'guardian_name.string' => 'Enter a valid name.',
            'guardian_name.regex' => 'Enter a valid name.',
            'guardian_contact.regex' => 'Use 09XXXXXXXXX or +639XXXXXXXXX for the guardian contact.',
        ]);

        $mobile = self::canonicalPhone($data['mobile_number'] ?? ($user->profile?->mobile_number ?? $user->mobile_number));
        $guardian = array_key_exists('guardian_contact', $data) ? $data['guardian_contact'] : $user->profile?->guardian_contact;
        $mobileChanged = array_key_exists('mobile_number', $data)
            && ($mobile !== self::canonicalPhone($user->mobile_number)
                || ($user->profile?->mobile_number !== null && $mobile !== self::canonicalPhone($user->profile->mobile_number)));
        $guardianChanged = array_key_exists('guardian_contact', $data)
            && self::canonicalPhone($guardian) !== self::canonicalPhone($user->profile?->guardian_contact);
        $savedContact = $user->healthProfile?->emergency_phone ?? $user->profile?->guardian_contact;
        if (($mobileChanged || $guardianChanged) && $mobile !== null
            && ($mobile === self::canonicalPhone($guardian)
                || ($mobileChanged && $mobile === self::canonicalPhone($savedContact)))) {
            throw ValidationException::withMessages(['guardian_contact' => ['Emergency contact number must be different from your mobile number.']]);
        }

        $user->update([
            'mobile_number' => $data['mobile_number'] ?? $user->mobile_number,
        ]);

        $profileUpdates = array_filter([
                'mobile_number' => $data['mobile_number'] ?? null,
                'address' => $data['address'] ?? null,
                'guardian_name' => $data['guardian_name'] ?? null,
                'guardian_relationship' => $data['guardian_relationship'] ?? null,
                'guardian_contact' => $data['guardian_contact'] ?? null,
            ], static fn ($value) => $value !== null);
        // An explicitly blank optional contact clears the saved value.
        // Omitting the field preserves it for older clients.
        if (array_key_exists('guardian_contact', $data)) {
            $profileUpdates['guardian_contact'] = $data['guardian_contact'];
        }
        $profile = StudentProfile::updateOrCreate(['user_id' => $user->id], $profileUpdates);

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'data' => [
                'user' => $user->fresh()->load('profile'),
                'profile' => $this->profileData($profile->fresh()),
            ],
        ]);
    }

    private static function canonicalPhone(?string $phone): ?string
    {
        if (preg_match('/^09[0-9]{9}$/', (string) $phone)) return '+63' . substr($phone, 1);
        if (preg_match('/^639[0-9]{9}$/', (string) $phone)) return '+' . $phone;
        return preg_match('/^\+639[0-9]{9}$/', (string) $phone) ? $phone : null;
    }

    public function uploadAvatar(Request $request)
    {
        $request->validate([
            'avatar' => 'required|image|mimes:jpg,jpeg,png,webp|max:2048',
        ]);

        $user = auth()->user();
        $profile = StudentProfile::firstOrCreate(['user_id' => $user->id]);

        $previous = $profile->profile_picture;
        $path = AvatarStore::store($request->file('avatar'));
        $profile->update(['profile_picture' => $path]);
        AvatarStore::delete($previous);

        return response()->json([
            'success' => true,
            'message' => 'Profile picture updated successfully.',
            'data' => [
                'profile_picture' => AvatarStore::url($path),
            ],
        ]);
    }

    // Public: <img> tags cannot send the bearer token. Names are random hashes.
    public function avatar(string $path)
    {
        return AvatarStore::response(AvatarStore::DIRECTORY . '/' . $path);
    }

    public function updateEmail(Request $request)
    {
        $user = auth()->user();
        $request->merge(['email' => strtolower(trim((string) $request->input('email')))]);
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['required', 'string'],
        ]);
        if (!Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['password' => ['Your current password is incorrect.']]);
        }
        $user->update(['email' => $data['email']]);
        return response()->json(['success' => true, 'message' => 'Email updated successfully.', 'data' => ['email' => $user->email]]);
    }

    private function emergencyContact($user): array
    {
        $health = $user->healthProfile()->first(['emergency_name', 'emergency_relationship', 'emergency_phone']);
        if ($health) {
            return ['name' => $health->emergency_name, 'relationship' => $health->emergency_relationship,
                'phone' => $health->emergency_phone, 'source' => 'health_profile'];
        }
        // Preserve older contacts for accounts that have no health profile yet.
        return ['name' => $user->profile->guardian_name ?? null, 'relationship' => $user->profile->guardian_relationship ?? null,
            'phone' => $user->profile->guardian_contact ?? null, 'source' => 'legacy'];
    }

    public function removeAvatar()
    {
        $profile = StudentProfile::where('user_id', auth()->id())->first();

        if ($profile?->profile_picture) {
            AvatarStore::delete($profile->profile_picture);
            $profile->update(['profile_picture' => null]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Profile picture removed.',
            'data' => [
                'profile_picture' => null,
            ],
        ]);
    }

    private function profileData(?StudentProfile $profile): ?array
    {
        if (!$profile) {
            return null;
        }

        $data = $profile->toArray();

        if ($profile->profile_picture) {
            $data['profile_picture'] = AvatarStore::url($profile->profile_picture);
        }

        return $data;
    }
}
