<?php

namespace Tests\Feature;

use App\Mail\PasswordResetMail;
use App\Models\PasswordReset;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

class PasswordRecoveryAccountTypeTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    private function user(string $role): User
    {
        return User::create([
            'first_name' => 'Recovery', 'last_name' => 'Test',
            'email' => Str::uuid() . '@example.test',
            'password' => Hash::make('OriginalPass123!'), 'role' => $role,
        ]);
    }

    public static function rolePairs(): array
    {
        return [
            'student to student' => ['student', 'student', true],
            'student to nurse' => ['student', 'nurse', false],
            'nurse to nurse' => ['nurse', 'nurse', true],
            'nurse to student' => ['nurse', 'student', false],
        ];
    }

    /** @dataProvider rolePairs */
    public function test_forgot_password_and_resend_enforce_account_type(string $context, string $role, bool $allowed): void
    {
        $user = $this->user($role);
        $payload = ['email' => $user->email, 'account_type' => $context];
        $this->postJson('/api/auth/forgot-password', $payload)->assertStatus($allowed ? 200 : 400);

        if (!$allowed) {
            Mail::assertNothingSent();
            $this->assertSame(0, PasswordReset::where('user_id', $user->id)->count());
            return;
        }

        $first = PasswordReset::where('user_id', $user->id)->firstOrFail();
        $this->postJson('/api/auth/forgot-password', $payload)->assertOk();
        $this->assertTrue((bool) $first->fresh()->is_used);
        $this->assertSame(1, PasswordReset::where('user_id', $user->id)->where('is_used', false)->count());
        Mail::assertSent(PasswordResetMail::class, 2);
        Mail::assertSent(PasswordResetMail::class, fn ($mail) => $mail->hasTo($user->email));
    }

    /** @dataProvider rolePairs */
    public function test_verification_and_reset_preserve_account_type(string $context, string $role, bool $allowed): void
    {
        $user = $this->user($role);
        $originalHash = $user->password;
        $reset = PasswordReset::create([
            'user_id' => $user->id, 'otp_hash' => Hash::make('123456'),
            'expires_at' => now()->addMinutes(10), 'is_used' => false,
        ]);
        $payload = ['email' => $user->email, 'otp' => '123456', 'account_type' => $context];
        $this->postJson('/api/auth/verify-password-reset-otp', $payload)->assertStatus($allowed ? 200 : 400);
        $this->assertFalse((bool) $reset->fresh()->is_used);
        $this->postJson('/api/auth/reset-password', array_merge($payload, [
            'password' => 'ReplacementPass123!', 'password_confirmation' => 'ReplacementPass123!',
        ]))->assertStatus($allowed ? 200 : 400);

        if ($allowed) {
            $this->assertTrue(Hash::check('ReplacementPass123!', $user->fresh()->password));
            $this->assertTrue((bool) $reset->fresh()->is_used);
        } else {
            $this->assertSame($originalHash, $user->fresh()->password);
            $this->assertFalse((bool) $reset->fresh()->is_used);
        }
        Mail::assertNothingSent();
    }

    public static function invalidContexts(): array
    {
        $cases = [];
        foreach (['forgot-password', 'verify-password-reset-otp', 'reset-password'] as $endpoint) {
            foreach (['omitted' => [], 'null' => ['account_type' => null],
                'empty' => ['account_type' => ''], 'invalid' => ['account_type' => 'admin']] as $name => $context) {
                $cases[$endpoint . ' ' . $name] = [$endpoint, $context];
            }
        }
        return $cases;
    }

    /** @dataProvider invalidContexts */
    public function test_missing_or_invalid_context_fails_validation_without_side_effects(string $endpoint, array $context): void
    {
        $user = $this->user('nurse');
        $originalHash = $user->password;
        $reset = PasswordReset::create([
            'user_id' => $user->id, 'otp_hash' => Hash::make('123456'),
            'expires_at' => now()->addMinutes(10), 'is_used' => false,
        ]);
        $this->postJson('/api/auth/' . $endpoint, array_merge([
            'email' => $user->email, 'otp' => '123456',
            'password' => 'ReplacementPass123!', 'password_confirmation' => 'ReplacementPass123!',
        ], $context))->assertStatus(422)->assertJsonValidationErrors('account_type');
        Mail::assertNothingSent();
        $this->assertSame($originalHash, $user->fresh()->password);
        $this->assertFalse((bool) $reset->fresh()->is_used);
        $this->assertSame(1, PasswordReset::where('user_id', $user->id)->count());
    }
}
