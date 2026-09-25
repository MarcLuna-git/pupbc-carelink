<?php

namespace App\Repositories\Eloquent;

use App\Models\EmailVerification;
use App\Models\User;
use App\Repositories\Contracts\EmailVerificationRepositoryInterface;
use Illuminate\Support\Str;

class EmailVerificationRepository implements EmailVerificationRepositoryInterface
{
    public function create(User $user, string $email, string $otp, int $expiryMinutes = 5): EmailVerification
    {
        return EmailVerification::create([
            'id' => Str::uuid(),
            'user_id' => $user->id,
            'email' => $email,
            'otp' => $otp,
            'expires_at' => now()->addMinutes($expiryMinutes),
            'is_used' => false,
        ]);
    }

    public function findValidOtp(User $user, string $otp): ?EmailVerification
    {
        return EmailVerification::where('user_id', $user->id)
            ->where('otp', $otp)
            ->where('is_used', false)
            ->where('expires_at', '>', now())
            ->latest()
            ->first();
    }

    public function markAsUsed(EmailVerification $verification): bool
    {
        return $verification->update(['is_used' => true]);
    }

    public function invalidateOldOtps(User $user): void
    {
        EmailVerification::where('user_id', $user->id)
            ->where('is_used', false)
            ->update(['is_used' => true]);
    }
}