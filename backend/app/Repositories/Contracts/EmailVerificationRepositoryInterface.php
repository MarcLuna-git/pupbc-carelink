<?php

namespace App\Repositories\Contracts;

use App\Models\EmailVerification;
use App\Models\User;

interface EmailVerificationRepositoryInterface
{
    public function create(User $user, string $email, string $otp, int $expiryMinutes = 5): EmailVerification;
    public function findValidOtp(User $user, string $otp): ?EmailVerification;
    public function markAsUsed(EmailVerification $verification): bool;
    public function invalidateOldOtps(User $user): void;
}