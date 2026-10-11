<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Chatbot\GeminiClient;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Phase 4 hardening: error-state classification, the circuit breaker, and the
 * daily abuse limit.
 */
class ChatbotHardeningTest extends TestCase
{
    use DatabaseTransactions;

    private const ENDPOINT = '/api/student/chatbot/message';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.gemini.key' => 'test-gemini-key',
            'chatbot.enabled' => true,
            'chatbot.circuit_breaker.enabled' => true,
            'chatbot.circuit_breaker.failure_threshold' => 3,
            'chatbot.circuit_breaker.cooldown_seconds' => 60,
        ]);

        // The breaker lives in the cache, so every test starts from a clean slate.
        Cache::flush();
    }

    private function student(array $attributes = []): User
    {
        return User::create(array_merge([
            'student_id' => 'STUDENT-' . Str::random(10),
            'first_name' => 'Student',
            'last_name' => 'Test',
            'email' => Str::uuid() . '@example.test',
            'password' => Hash::make('TestPassword123!'),
            'birthday' => '2002-05-15',
            'role' => 'student',
            'status' => null,
        ], $attributes));
    }

    /**
     * @param  array<string, mixed>  $candidate
     */
    private function fakeGemini(array $candidate, int $status = 200): void
    {
        $this->resetHttpFakes();

        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(
                ['candidates' => [$candidate]],
                $status
            ),
        ]);
    }

    /**
     * Drop previously registered stubs.
     *
     * Http::fake() merges into the existing stub list rather than replacing it,
     * so a second fake() in the same test would otherwise never take effect.
     */
    private function resetHttpFakes(): void
    {
        $this->app->instance(Factory::class, new Factory());
        Http::clearResolvedInstances();
    }

    private function ask(User $student, string $message = 'Hello')
    {
        return $this->actingAs($student, 'api')
            ->postJson(self::ENDPOINT, ['message' => $message]);
    }

    /*
    |--------------------------------------------------------------------------
    | Error-state classification
    |--------------------------------------------------------------------------
    */

    public function test_blocked_prompt_returns_the_blocked_reply(): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'promptFeedback' => ['blockReason' => 'PROHIBITED_CONTENT'],
            ]),
        ]);

        $response = $this->ask($this->student())
            ->assertStatus(200)
            ->assertJson(['success' => true, 'data' => ['degraded' => true]]);

        $this->assertSame(
            config('chatbot.fallback_replies.blocked'),
            $response->json('data.reply')
        );
    }

    public function test_safety_finish_reason_returns_the_safety_reply(): void
    {
        $this->fakeGemini([
            'finishReason' => 'SAFETY',
            'content' => ['parts' => []],
        ]);

        $response = $this->ask($this->student())
            ->assertStatus(200)
            ->assertJson(['success' => true, 'data' => ['degraded' => true]]);

        $this->assertSame(
            config('chatbot.fallback_replies.safety'),
            $response->json('data.reply')
        );
    }

    public function test_truncated_reply_returns_the_partial_text_as_a_success(): void
    {
        $this->fakeGemini([
            'finishReason' => 'MAX_TOKENS',
            'content' => ['parts' => [['text' => 'The clinic is open from 8:00 AM']]],
        ]);

        $this->ask($this->student())
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'reply' => 'The clinic is open from 8:00 AM',
                    'degraded' => false,
                ],
            ]);
    }

    public function test_normal_finish_reason_still_returns_the_reply(): void
    {
        $this->fakeGemini([
            'finishReason' => 'STOP',
            'content' => ['parts' => [['text' => 'Bukas ang clinic ng 8:00 AM.']]],
        ]);

        $this->ask($this->student())
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'reply' => 'Bukas ang clinic ng 8:00 AM.',
                    'degraded' => false,
                ],
            ]);
    }

    public function test_timeout_returns_the_timeout_reply(): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*' => function () {
                throw new \Illuminate\Http\Client\ConnectionException('Operation timed out');
            },
        ]);

        $response = $this->ask($this->student())
            ->assertStatus(200)
            ->assertJson(['success' => true, 'data' => ['degraded' => true]]);

        $this->assertSame(
            config('chatbot.fallback_replies.timeout'),
            $response->json('data.reply')
        );
    }

    public function test_unconfigured_key_returns_the_unconfigured_reply(): void
    {
        config(['services.gemini.key' => '']);
        Http::fake();

        $response = $this->ask($this->student())
            ->assertStatus(200)
            ->assertJson(['success' => true, 'data' => ['degraded' => true]]);

        $this->assertSame(
            config('chatbot.fallback_replies.unconfigured'),
            $response->json('data.reply')
        );

        Http::assertNothingSent();
    }

    /*
    |--------------------------------------------------------------------------
    | Circuit breaker
    |--------------------------------------------------------------------------
    */

    public function test_circuit_opens_after_the_failure_threshold(): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(['error' => 'boom'], 500),
        ]);

        $student = $this->student();
        $threshold = (int) config('chatbot.circuit_breaker.failure_threshold');

        for ($i = 0; $i < $threshold; $i++) {
            $this->ask($student, 'Attempt ' . $i)->assertStatus(200);
        }

        // The breaker is now open, so the next request must not reach Gemini.
        $this->resetHttpFakes();
        Http::fake();

        $response = $this->ask($student, 'After the breaker opened')
            ->assertStatus(200)
            ->assertJson(['success' => true, 'data' => ['degraded' => true]]);

        $this->assertSame(
            config('chatbot.fallback_replies.circuit_open'),
            $response->json('data.reply')
        );

        Http::assertNothingSent();
    }

    public function test_circuit_resets_after_a_successful_call(): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(['error' => 'boom'], 500),
        ]);

        $student = $this->student();

        // One failure short of the threshold.
        $this->ask($student, 'Failure')->assertStatus(200);

        $this->fakeGemini([
            'finishReason' => 'STOP',
            'content' => ['parts' => [['text' => 'Recovered.']]],
        ]);

        $this->ask($student, 'Recover')
            ->assertStatus(200)
            ->assertJson(['data' => ['reply' => 'Recovered.', 'degraded' => false]]);

        // The counter was cleared, so the breaker needs a full run of failures again.
        $this->resetHttpFakes();
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(['error' => 'boom'], 500),
        ]);

        $this->ask($student, 'Failure again')->assertStatus(200);

        $this->resetHttpFakes();
        Http::fake();

        $this->ask($student, 'Still allowed through')
            ->assertStatus(200)
            ->assertJson(['data' => ['degraded' => true]]);

        // Gemini was reached, proving the breaker is still closed.
        Http::assertSentCount(1);
    }

    public function test_blocked_and_safety_responses_do_not_trip_the_circuit(): void
    {
        $student = $this->student();
        $threshold = (int) config('chatbot.circuit_breaker.failure_threshold');

        // Well past the threshold, but every one of these is a working response.
        for ($i = 0; $i < $threshold + 2; $i++) {
            $this->resetHttpFakes();

            Http::fake([
                'generativelanguage.googleapis.com/*' => Http::response([
                    'promptFeedback' => ['blockReason' => 'PROHIBITED_CONTENT'],
                ]),
            ]);

            $this->ask($student, 'Blocked ' . $i)->assertStatus(200);
        }

        $this->fakeGemini([
            'finishReason' => 'STOP',
            'content' => ['parts' => [['text' => 'Still working.']]],
        ]);

        $this->ask($student, 'Normal question')
            ->assertStatus(200)
            ->assertJson(['data' => ['reply' => 'Still working.', 'degraded' => false]]);
    }

    public function test_circuit_breaker_can_be_disabled(): void
    {
        config(['chatbot.circuit_breaker.enabled' => false]);

        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(['error' => 'boom'], 500),
        ]);

        $student = $this->student();
        $threshold = (int) config('chatbot.circuit_breaker.failure_threshold');

        for ($i = 0; $i < $threshold + 2; $i++) {
            $this->ask($student, 'Attempt ' . $i)->assertStatus(200);
        }

        // With the breaker off, Gemini is still called every time.
        Http::assertSentCount($threshold + 2);
    }

    /*
    |--------------------------------------------------------------------------
    | Daily limit
    |--------------------------------------------------------------------------
    */

    public function test_daily_limit_is_enforced(): void
    {
        config(['chatbot.daily_limit' => 3]);

        $this->fakeGemini([
            'finishReason' => 'STOP',
            'content' => ['parts' => [['text' => 'Ok.']]],
        ]);

        $student = $this->student();

        for ($i = 0; $i < 3; $i++) {
            $this->ask($student, 'Message ' . $i)->assertStatus(200);
        }

        $this->ask($student, 'One too many')->assertStatus(429);
    }

    public function test_daily_limit_is_tracked_per_student(): void
    {
        config(['chatbot.daily_limit' => 2]);

        $this->fakeGemini([
            'finishReason' => 'STOP',
            'content' => ['parts' => [['text' => 'Ok.']]],
        ]);

        $first = $this->student();
        $second = $this->student();

        $this->ask($first, 'A')->assertStatus(200);
        $this->ask($first, 'B')->assertStatus(200);
        $this->ask($first, 'C')->assertStatus(429);

        // A different student has their own allowance.
        $this->ask($second, 'A')->assertStatus(200);
    }

    /*
    |--------------------------------------------------------------------------
    | Generation settings
    |--------------------------------------------------------------------------
    */

    public function test_generation_settings_are_sent_to_gemini(): void
    {
        config([
            'services.gemini.max_output_tokens' => 1024,
            'services.gemini.safety_settings' => [
                ['category' => 'HARM_CATEGORY_DANGEROUS_CONTENT', 'threshold' => 'BLOCK_ONLY_HIGH'],
            ],
        ]);

        $this->fakeGemini([
            'finishReason' => 'STOP',
            'content' => ['parts' => [['text' => 'Ok.']]],
        ]);

        $this->ask($this->student())->assertStatus(200);

        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['generationConfig']['maxOutputTokens'] ?? null) === 1024
                && ($body['safetySettings'][0]['threshold'] ?? null) === 'BLOCK_ONLY_HIGH';
        });
    }

    public function test_client_returns_a_reason_code_for_each_failure_kind(): void
    {
        $client = app(GeminiClient::class);

        config(['services.gemini.key' => '']);
        $this->assertSame('unconfigured', $client->generate('prompt', [])['reason']);

        config(['services.gemini.key' => 'test-gemini-key']);

        $this->resetHttpFakes();
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(['error' => 'boom'], 503),
        ]);
        $this->assertSame('http', $client->generate('prompt', [])['reason']);

        $this->resetHttpFakes();
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [['finishReason' => 'RECITATION', 'content' => ['parts' => []]]],
            ]),
        ]);
        $this->assertSame('safety', $client->generate('prompt', [])['reason']);

        $this->resetHttpFakes();
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [['finishReason' => 'STOP', 'content' => ['parts' => []]]],
            ]),
        ]);
        $this->assertSame('empty', $client->generate('prompt', [])['reason']);

        $this->resetHttpFakes();
        Http::fake([
            'generativelanguage.googleapis.com/*' => function () {
                throw new ConnectionException('Operation timed out');
            },
        ]);
        $this->assertSame('timeout', $client->generate('prompt', [])['reason']);
    }
}
