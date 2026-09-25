<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\StudentProfile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

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
            ],
        ]);
    }

    public function update(Request $request)
    {
        $user = auth()->user();

        $data = $request->validate([
            'mobile_number' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:1000',
            'guardian_name' => 'nullable|string|max:255',
            'guardian_relationship' => 'nullable|string|max:100',
            'guardian_contact' => 'nullable|string|max:20',
        ]);

        $user->update([
            'mobile_number' => $data['mobile_number'] ?? $user->mobile_number,
        ]);

        $profile = StudentProfile::updateOrCreate(
            ['user_id' => $user->id],
            array_filter([
                'mobile_number' => $data['mobile_number'] ?? null,
                'address' => $data['address'] ?? null,
                'guardian_name' => $data['guardian_name'] ?? null,
                'guardian_relationship' => $data['guardian_relationship'] ?? null,
                'guardian_contact' => $data['guardian_contact'] ?? null,
            ], static fn ($value) => $value !== null)
        );

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'data' => [
                'user' => $user->fresh()->load('profile'),
                'profile' => $this->profileData($profile->fresh()),
            ],
        ]);
    }

    public function uploadAvatar(Request $request)
    {
        $request->validate([
            'avatar' => 'required|image|mimes:jpg,jpeg,png,webp|max:2048',
        ]);

        $user = auth()->user();
        $profile = StudentProfile::firstOrCreate(['user_id' => $user->id]);

        if ($profile->profile_picture) {
            Storage::disk('public')->delete($profile->profile_picture);
        }

        $path = $request->file('avatar')->store('student-avatars', 'public');
        $profile->update(['profile_picture' => $path]);

        return response()->json([
            'success' => true,
            'message' => 'Profile picture updated successfully.',
            'data' => [
                'profile_picture' => Storage::disk('public')->url($path),
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
            $data['profile_picture'] = Storage::disk('public')
                ->url($profile->profile_picture);
        }

        return $data;
    }
}
