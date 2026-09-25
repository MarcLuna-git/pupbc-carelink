<?php

namespace Tests\Feature;

use Carbon\Carbon;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class CorsRateLimitTest extends TestCase
{
    private const ORIGIN = 'https://pupbc-carelink-testing.vercel.app';

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('array', config('cache.default'));
        Carbon::setTestNow(Carbon::parse('2026-09-24 12:00:00'));
        Mail::fake();
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.71']);
        $this->withHeader('Origin', self::ORIGIN);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function preflight(string $origin = self::ORIGIN)
    {
        return $this->call('OPTIONS', '/api/auth/register', [], [], [], [
            'HTTP_ORIGIN' => $origin,
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'content-type,authorization',
        ]);
    }

    private function exhaustRegistrationQuota(): void
    {
        for ($attempt = 0; $attempt < 10; $attempt++) {
            // Empty payloads exercise real validation/throttles without creating users or OTPs.
            $this->postJson('/api/auth/register', [])->assertStatus(422);
        }
    }

    public function test_registration_is_limited_but_preflight_still_works_and_retry_recovers(): void
    {
        $this->exhaustRegistrationQuota();
        $response = $this->postJson('/api/auth/register', []);
        $response->assertStatus(429)->assertJsonPath('error_code', 'RATE_LIMITED')
            ->assertHeader('Access-Control-Allow-Origin', self::ORIGIN)
            ->assertHeader('Access-Control-Allow-Credentials', 'true')
            ->assertHeader('Retry-After', '60')
            ->assertHeader('X-RateLimit-Limit', '10')
            ->assertHeader('X-RateLimit-Remaining', '0')
            ->assertHeader('X-RateLimit-Reset');
        $this->assertSame((int) $response->headers->get('Retry-After'), $response->json('retry_after'));
        $this->preflight()->assertStatus(204)->assertHeader('Access-Control-Allow-Origin', self::ORIGIN)
            ->assertHeaderMissing('Retry-After');
        $this->postJson('/api/auth/register', [])->assertStatus(429);
        Carbon::setTestNow(Carbon::now()->addSeconds(61));
        $this->postJson('/api/auth/register', [])->assertStatus(422)
            ->assertHeader('Access-Control-Allow-Origin', self::ORIGIN);
        Mail::assertNothingSent();
    }

    public function test_preflights_do_not_consume_registration_quota(): void
    {
        for ($attempt = 0; $attempt < 12; $attempt++) {
            $this->preflight()->assertStatus(204)->assertHeader('Access-Control-Allow-Origin', self::ORIGIN);
        }
        $this->exhaustRegistrationQuota();
        $this->postJson('/api/auth/register', [])->assertStatus(429);
        Mail::assertNothingSent();
    }

    public function test_announcement_polling_does_not_consume_auth_quota(): void
    {
        for ($attempt = 0; $attempt < 11; $attempt++) {
            $this->getJson('/api/announcements')->assertOk();
        }
        $this->exhaustRegistrationQuota();
        $this->postJson('/api/auth/register', [])->assertStatus(429);
        Mail::assertNothingSent();
    }

    public function test_exhausted_global_api_quota_does_not_block_preflight(): void
    {
        for ($attempt = 0; $attempt < 60; $attempt++) {
            $this->getJson('/api/test')->assertOk();
        }
        $this->postJson('/api/auth/register', [])->assertStatus(429)
            ->assertHeader('Access-Control-Allow-Origin', self::ORIGIN)
            ->assertHeader('X-RateLimit-Limit', '60')->assertHeader('Retry-After', '60');
        $this->preflight()->assertStatus(204)->assertHeader('Access-Control-Allow-Origin', self::ORIGIN);
        Mail::assertNothingSent();
    }

    public function test_untrusted_origin_gets_no_cors_permission_even_when_rate_limited(): void
    {
        $origin = 'https://untrusted-project.vercel.app';
        $this->withHeader('Origin', $origin);
        $this->exhaustRegistrationQuota();
        $this->postJson('/api/auth/register', [])->assertStatus(429)
            ->assertHeaderMissing('Access-Control-Allow-Origin')
            ->assertHeaderMissing('Access-Control-Allow-Credentials')
            ->assertHeader('Retry-After', '60');
        $this->preflight($origin)->assertStatus(204)
            ->assertHeaderMissing('Access-Control-Allow-Origin')
            ->assertHeaderMissing('Access-Control-Allow-Credentials');
        Mail::assertNothingSent();
    }
}
