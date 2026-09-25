<?php

namespace App\Services;

use App\Mail\PasswordResetMail;
use App\Mail\VerifyEmail;
use App\Models\PasswordReset;
use App\Models\PendingRegistration;
use App\Models\User;
use App\Repositories\Contracts\UserRepositoryInterface;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tymon\JWTAuth\Facades\JWTAuth;

class AuthService
{
    protected UserRepositoryInterface $userRepository;

    private const OTP_EXPIRY_MINUTES = 10;

    public function __construct(
        UserRepositoryInterface $userRepository
    ) {
        $this->userRepository = $userRepository;
    }

    protected function register(array $data): array
    {
        $user = $this->userRepository->create([
            'student_id' => $data['student_id'],
            'first_name' => $data['first_name'],
            'middle_name' => $data['middle_name'] ?? null,
            'last_name' => $data['last_name'],
            'email' => $data['email'],
            'password' => $data['password_hash'],
            'role' => 'student',
            'birthday' => $data['birthday'] ?? null,
            'gender' => isset($data['gender']) ? strtolower($data['gender']) : null,
            'course' => $data['course'] ?? null,
            'year' => $data['year'] ?? null,
            'section' => $data['section'] ?? null,
            'mobile_number' => $data['mobile_number'] ?? null,
            'email_verified_at' => now(),
            'status' => null,
        ]);

        $this->generateQRCode($user);

        return [
            'user' => $user,
            'message' => 'Registration successful. You can now login.',
        ];
    }

    public function requestRegistrationOtp(array $data): array
    {
        // Expired pending rows must not block a corrected re-registration.
        PendingRegistration::where('expires_at', '<', now())
            ->where(function ($query) use ($data) {
                $query->where('email', $data['email'])
                    ->orWhere('student_id', $data['student_id']);
            })
            ->delete();

        if (
            User::where('email', $data['email'])
                ->orWhere('student_id', $data['student_id'])
                ->exists()
            ||
            PendingRegistration::where('email', '!=', $data['email'])
                ->where('student_id', $data['student_id'])
                ->exists()
        ) {
            throw new \Exception(
                'This email or Student ID is already registered.'
            );
        }

        if (PendingRegistration::where('email', $data['email'])->exists()) {
            return [
                'message' => 'A registration is already pending for this email. Enter your code or use Resend verification code to continue with the original details.',
            ];
        }

        $otp = $this->generateOtp();

        $data['password_hash'] = Hash::make($data['password']);

        unset(
            $data['password'],
            $data['password_confirmation']
        );

        $pending = PendingRegistration::create(
            [
                'email' => $data['email'],
                'student_id' => $data['student_id'],
                'payload' => $data,
                'otp_hash' => Hash::make($otp),
                'expires_at' => now()->addMinutes(self::OTP_EXPIRY_MINUTES),
            ]
        );

        $mailUser = new User([
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'email' => $data['email'],
        ]);

        try {
            Mail::to($data['email'])
                ->send(
                    new VerifyEmail(
                        $mailUser,
                        $otp
                    )
                );
        } catch (\Throwable $e) {
            // Retain the pending record: a timeout does not prove delivery failed.
            \Log::error('Registration OTP email delivery was not confirmed.');

            throw new \App\Exceptions\RegistrationDeliveryException(
                'Email delivery was not confirmed. Your registration is pending. Enter your code if received, or use Resend verification code to try again.'
            );
        }

        return [
            'message' =>
                'A 6-digit verification code was sent to your email. It is valid for ' .
                self::OTP_EXPIRY_MINUTES .
                ' minutes.',
        ];
    }

    // Sa resend, papalitan ang OTP hash kaya invalid na ang lumang code.
    public function resendRegistrationOtp(string $email): array
    {
        $pending = PendingRegistration::where('email', $email)->first();

        if (!$pending) {
            throw new \Exception(
                'No pending registration found for this email. Please register again.'
            );
        }

        $otp = $this->generateOtp();

        $pending->update([
            'otp_hash' => Hash::make($otp),
            'expires_at' => now()->addMinutes(self::OTP_EXPIRY_MINUTES),
        ]);

        $payload = $pending->payload;

        $mailUser = new User([
            'first_name' => $payload['first_name'] ?? '',
            'last_name' => $payload['last_name'] ?? '',
            'email' => $email,
        ]);

        try {
            Mail::to($email)
                ->send(
                    new VerifyEmail(
                        $mailUser,
                        $otp
                    )
                );
        } catch (\Throwable $e) {
            \Log::error(
                'Registration resend OTP email failed.'
            );

            throw new \Exception(
                'We could not resend the verification code. Please try again later.'
            );
        }

        return [
            'message' =>
                'A new verification code was sent to your email. It is valid for ' .
                self::OTP_EXPIRY_MINUTES .
                ' minutes.',
        ];
    }

    public function verifyRegistration(string $email, string $otp): array
    {
        return DB::transaction(function () use ($email, $otp) {
            $pending = PendingRegistration::where('email', $email)
                ->lockForUpdate()
                ->first();

            if (!$pending) {
                throw new \Exception(
                    'No pending registration found. Please register again.'
                );
            }

            // I-compare ang expiry timestamp para tama ang expired-OTP error.
            if (
                !$pending->expires_at ||
                now()->greaterThanOrEqualTo(
                    Carbon::parse($pending->expires_at)
                )
            ) {
                throw new \Exception(
                    'Verification code has expired. Please request a new OTP.'
                );
            }

            if (!Hash::check($otp, $pending->otp_hash)) {
                throw new \Exception(
                    'Invalid verification code.'
                );
            }

            if (
                User::where('email', $email)
                    ->orWhere(
                        'student_id',
                        $pending->student_id
                    )
                    ->exists()
            ) {
                throw new \Exception(
                    'This email or Student ID is already registered.'
                );
            }

            $user = $this->register(
                $pending->payload
            )['user'];

            $pending->delete();

            return [
                'user' => $user,
                'message' =>
                    'Registration successful. You can now login.',
            ];
        });
    }

    public function login(array $credentials): array
    {
        $user = $this->userRepository
            ->findByStudentId(
                $credentials['student_id']
            );

        if (
            !$user ||
            $user->role !== 'student' ||
            in_array($user->status, ['inactive', 'archived'], true)
        ) {
            throw new \Exception(
                'Invalid credentials.'
            );
        }

        $birthday = $user->birthday instanceof \DateTime
            ? $user->birthday->format('Y-m-d')
            : Carbon::parse($user->birthday)
                ->format('Y-m-d');

        if (
            $birthday !==
            $credentials['birthday']
        ) {
            throw new \Exception(
                'Invalid birthday.'
            );
        }

        if (
            !$this->verifyPassword(
                $credentials['password'],
                $user->password
            )
        ) {
            throw new \Exception(
                'Invalid password.'
            );
        }

        $token = JWTAuth::fromUser($user);

        $ttl = JWTAuth::factory()
            ->getTTL();

        return [
            'user' => $user,
            'token' => $token,
            'token_type' => 'bearer',
            'expires_in' => $ttl * 60,
            'role' => $user->role,
        ];
    }

    public function nurseLogin(
        string $email,
        string $password
    ): array {
        $user = User::where(
            'email',
            $email
        )
            ->where(
                'role',
                'nurse'
            )
            ->first();

        if (
            !$user ||
            in_array($user->status, ['inactive', 'archived'], true) ||
            !$this->verifyPassword(
                $password,
                $user->password
            )
        ) {
            throw new \Exception(
                'Invalid credentials.'
            );
        }

        $token = JWTAuth::fromUser($user);

        $ttl = JWTAuth::factory()
            ->getTTL();

        return [
            'user' => $user,
            'token' => $token,
            'token_type' => 'bearer',
            'expires_in' => $ttl * 60,
            'role' => $user->role,
        ];
    }

    // Sa resend, i-invalidate muna ang dating unused OTP.
    public function forgotPassword(array $data): array
    {
        $user = $this->userRepository
            ->findByEmail(
                $data['email']
            );

        if (!$user) {
            throw new \Exception(
                'Email not found.'
            );
        }

        PasswordReset::where(
            'user_id',
            $user->id
        )
            ->where(
                'is_used',
                false
            )
            ->update([
                'is_used' => true,
            ]);

        $otp = $this->generateOtp();

        $reset = PasswordReset::create([
            'user_id' => $user->id,
            'otp_hash' => Hash::make($otp),
            'expires_at' => now()
                ->addMinutes(
                    self::OTP_EXPIRY_MINUTES
                ),
            'is_used' => false,
        ]);

        try {
            Mail::to($user->email)
                ->send(
                    new PasswordResetMail(
                        $user,
                        $otp
                    )
                );
        } catch (\Throwable $e) {
            \Log::error(
                'Password reset email failed.'
            );

            $reset->update([
                'is_used' => true,
            ]);

            throw new \Exception(
                'We could not send the password reset code. Please try again later.'
            );
        }

        return [
            'message' =>
                'A password reset code was sent to your email. It is valid for ' .
                self::OTP_EXPIRY_MINUTES .
                ' minutes.',
        ];
    }

    public function resetPassword(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $user = $this->userRepository
                ->findByEmail(
                    $data['email']
                );

            if (!$user) {
                throw new \Exception(
                    'Email not found.'
                );
            }

            $pr = PasswordReset::where(
                'user_id',
                $user->id
            )
                ->where(
                    'is_used',
                    false
                )
                ->latest('created_at')
                ->lockForUpdate()
                ->first();

            if (!$pr) {
                throw new \Exception(
                    'No active password reset request found.'
                );
            }

            if (
                !$pr->expires_at ||
                now()->greaterThanOrEqualTo(
                    Carbon::parse(
                        $pr->expires_at
                    )
                )
            ) {
                $pr->update([
                    'is_used' => true,
                ]);

                throw new \Exception(
                    'Password reset code has expired. Please request a new OTP.'
                );
            }

            if (
                !Hash::check(
                    $data['otp'],
                    $pr->otp_hash
                )
            ) {
                throw new \Exception(
                    'Invalid password reset code.'
                );
            }

            $pr->update([
                'is_used' => true,
            ]);

            $this->userRepository->update(
                $user,
                [
                    'password' =>
                        Hash::make(
                            $data['password']
                        ),
                ]
            );

            return [
                'message' =>
                    'Password reset successfully.',
            ];
        });
    }

    public function changePassword(array $data): array
    {
        $user = auth()->user();

        if (
            !$user ||
            !$this->verifyPassword(
                $data['current_password'],
                $user->password
            )
        ) {
            throw new \Exception(
                'Current password is incorrect.'
            );
        }

        $this->userRepository->update(
            $user,
            [
                'password' =>
                    Hash::make(
                        $data['new_password']
                    ),
            ]
        );

        return [
            'message' =>
                'Password updated successfully.',
        ];
    }

    public function logout(): bool
    {
        JWTAuth::invalidate(
            JWTAuth::getToken()
        );

        return true;
    }

    public function refreshToken(): array
    {
        $token = JWTAuth::refresh(
            JWTAuth::getToken()
        );

        $ttl = JWTAuth::factory()
            ->getTTL();

        return [
            'token' => $token,
            'token_type' => 'bearer',
            'expires_in' => $ttl * 60,
        ];
    }

    public function getAuthenticatedUser()
    {
        return auth()
            ->user()
            ->load(
                'profile',
                'qrCode'
            );
    }

    protected function verifyPassword(
        string $input,
        string $stored
    ): bool {
        return Hash::check(
            $input,
            $stored
        );
    }

    protected function generateOtp(): string
    {
        return str_pad(
            (string) random_int(
                0,
                999999
            ),
            6,
            '0',
            STR_PAD_LEFT
        );
    }

    protected function generateQRCode(
        User $user
    ): void {
        $hash = hash(
            'sha256',
            $user->id .
            Str::random(32)
        );

        $user->qrCode()->create([
            'qr_code_hash' => $hash,
            'is_active' => true,
        ]);
    }
}
