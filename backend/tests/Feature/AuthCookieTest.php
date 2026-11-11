<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\AuthCookie;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

// The sign-in token lives only in an httpOnly cookie per portal, and the API
// uses it only when the request names its portal in X-Portal.
class AuthCookieTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    // Each test request starts like a new server request: no signed-in guard and
    // no token left over in the JWT manager from the previous request.
    private function freshRequest(): void
    {
        auth()->forgetGuards();
        app('tymon.jwt')->unsetToken();
    }

    private function student(): User
    {
        return User::create([
            'student_id' => sprintf('2020-%05d-BN-0', random_int(0, 99999)),
            'first_name' => 'Cookie',
            'last_name' => 'Test',
            'email' => Str::uuid() . '@example.test',
            'password' => Hash::make('TestPassword123!'),
            'birthday' => '2002-05-15',
            'role' => 'student',
            'status' => null,
        ]);
    }

    private function nurse(): User
    {
        return User::create([
            'student_id' => 'NURSE-' . Str::random(8),
            'first_name' => 'Cookie',
            'last_name' => 'Nurse',
            'email' => Str::uuid() . '@example.test',
            'password' => Hash::make('TestPassword123!'),
            'role' => 'nurse',
            'status' => null,
        ]);
    }

    private function studentLogin(User $student)
    {
        return $this->postJson('/api/auth/login', [
            'student_id' => $student->student_id,
            'birthday' => '2002-05-15',
            'password' => 'TestPassword123!',
        ]);
    }

    public function test_login_sets_an_http_only_cookie_and_returns_no_token(): void
    {
        $response = $this->studentLogin($this->student())->assertOk()
            ->assertJsonMissing(['token_type' => 'bearer']);

        $this->assertArrayNotHasKey('token', $response->json());
        $cookie = $response->getCookie(AuthCookie::name('student'), false);
        $this->assertNotNull($cookie);
        $this->assertNotSame('', $cookie->getValue());
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertTrue($cookie->isSecure());
        $this->assertSame('strict', $cookie->getSameSite());
        $this->assertSame('/api', $cookie->getPath());
    }

    public function test_the_cookie_signs_in_only_with_the_matching_x_portal_header(): void
    {
        $student = $this->student();
        $token = $this->studentLogin($student)->getCookie(AuthCookie::name('student'), false)->getValue();
        $cookie = [AuthCookie::name('student') => $token];

        $this->freshRequest();
        $this->withCredentials()->withUnencryptedCookies($cookie)->withHeader('X-Portal', 'student')
            ->getJson('/api/auth/me')->assertOk()->assertJsonPath('user.id', $student->id);

        // No X-Portal (as in a cross-site form post): the cookie is not used.
        $this->freshRequest();
        $this->flushHeaders();
        $this->withCredentials()->withUnencryptedCookies($cookie)->getJson('/api/auth/me')->assertUnauthorized();

        // The other portal's name does not pick up the student cookie.
        $this->freshRequest();
        $this->withCredentials()->withUnencryptedCookies($cookie)->withHeader('X-Portal', 'nurse')
            ->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_nurse_login_uses_its_own_cookie(): void
    {
        $nurse = $this->nurse();
        $response = $this->postJson('/api/auth/nurse-login', ['email' => $nurse->email, 'password' => 'TestPassword123!'])
            ->assertOk();

        $this->assertArrayNotHasKey('token', $response->json());
        $this->assertNotNull($response->getCookie(AuthCookie::name('nurse'), false));
        $this->assertNull($response->getCookie(AuthCookie::name('student'), false));
    }

    public function test_logout_clears_the_cookie_and_invalidates_the_token(): void
    {
        $token = $this->studentLogin($this->student())->getCookie(AuthCookie::name('student'), false)->getValue();
        $cookie = [AuthCookie::name('student') => $token];

        $this->freshRequest();
        $logout = $this->withCredentials()->withUnencryptedCookies($cookie)->withHeader('X-Portal', 'student')
            ->postJson('/api/auth/logout')->assertOk();
        $cleared = $logout->getCookie(AuthCookie::name('student'), false);
        $this->assertNotNull($cleared);
        $this->assertTrue($cleared->isCleared());

        $this->freshRequest();
        $this->withCredentials()->withUnencryptedCookies($cookie)->withHeader('X-Portal', 'student')
            ->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_logout_without_a_session_still_clears_the_cookie(): void
    {
        $response = $this->withHeader('X-Portal', 'nurse')->postJson('/api/auth/logout')->assertOk();

        $this->assertTrue($response->getCookie(AuthCookie::name('nurse'), false)->isCleared());
    }
}
