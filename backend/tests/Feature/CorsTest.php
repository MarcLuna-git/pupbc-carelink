<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class CorsTest extends TestCase
{
    private const ORIGIN = 'https://pupbc-carelink-testing.vercel.app';

    private function preflight(string $origin, string $path = '/api/auth/register', string $method = 'POST')
    {
        return $this->call('OPTIONS', $path, [], [], [], [
            'HTTP_ORIGIN' => $origin,
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => $method,
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'content-type,authorization,x-kiosk-token',
        ]);
    }

    /** @dataProvider preflightRoutes */
    public function test_preflight_runs_before_authentication_and_requires_no_token(string $path, string $method): void
    {
        // Even an unconfigured JWT must not prevent the browser's preflight.
        config(['jwt.secret' => '']);
        Mail::fake();
        $response = $this->preflight(self::ORIGIN, $path, $method);
        $response->assertStatus(204)
            ->assertHeader('Access-Control-Allow-Origin', self::ORIGIN)
            ->assertHeader('Access-Control-Allow-Credentials', 'true');
        $methods = array_map('trim', explode(',', $response->headers->get('Access-Control-Allow-Methods')));
        $headers = array_map('trim', explode(',', strtolower($response->headers->get('Access-Control-Allow-Headers'))));
        $this->assertContains($method, $methods);
        $this->assertContains('OPTIONS', $methods);
        $this->assertNotContains('TRACE', $methods);
        foreach (['content-type', 'authorization', 'x-kiosk-token'] as $header) {
            $this->assertContains($header, $headers);
        }
        $this->assertStringContainsString('Origin', $response->headers->get('Vary'));
        Mail::assertNothingSent();
    }

    public static function preflightRoutes(): array
    {
        return [
            ['/api/auth/register', 'POST'],
            ['/api/student/profile', 'PUT'],
            ['/api/nurse/medicines', 'DELETE'],
            ['/api/kiosk/checkin', 'POST'],
        ];
    }

    public function test_announcements_response_has_exact_origin_headers(): void
    {
        $this->withHeader('Origin', self::ORIGIN)->getJson('/api/announcements')
            ->assertOk()->assertHeader('Access-Control-Allow-Origin', self::ORIGIN)
            ->assertHeader('Access-Control-Allow-Credentials', 'true');
    }

    public function test_authentication_and_not_found_errors_keep_cors_headers(): void
    {
        $this->withHeader('Origin', self::ORIGIN)->getJson('/api/student/profile')
            ->assertUnauthorized()->assertHeader('Access-Control-Allow-Origin', self::ORIGIN);
        $this->getJson('/api/cors-nonexistent-route')
            ->assertNotFound()->assertHeader('Access-Control-Allow-Origin', self::ORIGIN);
    }

    public function test_registration_validation_errors_keep_cors_headers_without_sending_mail(): void
    {
        Mail::fake();
        $this->withHeader('Origin', self::ORIGIN)->postJson('/api/auth/register', [])
            ->assertStatus(422)->assertHeader('Access-Control-Allow-Origin', self::ORIGIN);
        Mail::assertNothingSent();
    }

    public function test_missing_jwt_still_blocks_actual_requests_with_readable_cors_error(): void
    {
        config(['jwt.secret' => '']);
        $this->withHeader('Origin', self::ORIGIN)->postJson('/api/auth/register', [])
            ->assertStatus(503)->assertHeader('Access-Control-Allow-Origin', self::ORIGIN)
            ->assertJsonPath('message', 'Authentication is not configured.');
    }

    /** @dataProvider localOrigins */
    public function test_local_development_origins_still_work(string $origin): void
    {
        $this->preflight($origin)->assertStatus(204)->assertHeader('Access-Control-Allow-Origin', $origin);
    }

    public static function localOrigins(): array
    {
        return [['http://localhost:5173'], ['http://127.0.0.1:5173'], ['http://192.168.1.20:5173']];
    }

    /** @dataProvider untrustedOrigins */
    public function test_untrusted_origins_receive_no_cors_permission(string $origin): void
    {
        $this->preflight($origin)->assertHeaderMissing('Access-Control-Allow-Origin')
            ->assertHeaderMissing('Access-Control-Allow-Credentials');
        $this->withHeader('Origin', $origin)->getJson('/api/announcements')
            ->assertOk()->assertHeaderMissing('Access-Control-Allow-Origin')
            ->assertHeaderMissing('Access-Control-Allow-Credentials');
    }

    public static function untrustedOrigins(): array
    {
        return [
            ['https://untrusted.example'],
            ['https://another-project.vercel.app'],
            ['https://pupbc-carelink-testing.vercel.app.untrusted.example'],
            ['https://untrusted-project.onrender.com'],
        ];
    }
}
