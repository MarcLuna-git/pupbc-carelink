<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class ChatbotTest extends TestCase
{
    use DatabaseTransactions;

    private const ENDPOINT = '/api/student/chatbot/message';

    protected function setUp(): void
    {
        parent::setUp();

        // Simulate a configured key so the client reaches the (faked) HTTP layer.
        config([
            'services.gemini.key' => 'test-gemini-key',
            'chatbot.enabled' => true,
        ]);
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

    private function nurse(): User
    {
        return User::create([
            'first_name' => 'Nurse',
            'last_name' => 'Test',
            'email' => Str::uuid() . '@example.test',
            'password' => Hash::make('TestPassword123!'),
            'role' => 'nurse',
            'status' => null,
        ]);
    }

    private function fakeGeminiSuccess(string $text = 'The clinic is open from 8:00 AM to 5:00 PM.'): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    ['content' => ['parts' => [['text' => $text]]]],
                ],
            ]),
        ]);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->postJson(self::ENDPOINT, ['message' => 'Hello'])
            ->assertStatus(401);
    }

    public function test_nurse_cannot_use_the_student_chatbot(): void
    {
        $this->actingAs($this->nurse(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Hello'])
            ->assertStatus(403);
    }

    public function test_disabled_chatbot_returns_service_unavailable(): void
    {
        config(['chatbot.enabled' => false]);

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Hello'])
            ->assertStatus(503)
            ->assertJson(['success' => false]);
    }

    public function test_message_is_required(): void
    {
        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('message');
    }

    public function test_oversized_message_is_rejected(): void
    {
        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => str_repeat('a', 1001)])
            ->assertStatus(422)
            ->assertJsonValidationErrors('message');
    }

    public function test_history_is_capped(): void
    {
        $history = [];

        for ($i = 0; $i < 11; $i++) {
            $history[] = ['role' => 'user', 'text' => 'turn ' . $i];
        }

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Hello', 'history' => $history])
            ->assertStatus(422)
            ->assertJsonValidationErrors('history');
    }

    public function test_successful_reply_is_returned(): void
    {
        $this->fakeGeminiSuccess('Bukas ang clinic mula 8:00 AM hanggang 5:00 PM.');

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Anong oras bukas ang clinic?'])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'reply' => 'Bukas ang clinic mula 8:00 AM hanggang 5:00 PM.',
                    'degraded' => false,
                ],
            ]);
    }

    public function test_api_key_is_sent_as_a_header_not_in_the_url(): void
    {
        $this->fakeGeminiSuccess();

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Hello'])
            ->assertStatus(200);

        Http::assertSent(function ($request) {
            return $request->hasHeader('x-goog-api-key', 'test-gemini-key')
                && !str_contains($request->url(), 'test-gemini-key');
        });
    }

    public function test_provider_failure_returns_a_graceful_fallback(): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(['error' => 'boom'], 500),
        ]);

        $response = $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Hello'])
            ->assertStatus(200)
            ->assertJson(['success' => true, 'data' => ['degraded' => true]]);

        $this->assertStringContainsString(
            'unavailable',
            $response->json('data.reply')
        );
    }

    public function test_missing_api_key_returns_a_graceful_fallback(): void
    {
        config(['services.gemini.key' => '']);
        Http::fake();

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Hello'])
            ->assertStatus(200)
            ->assertJson(['success' => true, 'data' => ['degraded' => true]]);

        Http::assertNothingSent();
    }

    public function test_rate_limit_is_enforced(): void
    {
        $this->fakeGeminiSuccess();

        $student = $this->student();
        $limit = (int) config('chatbot.rate_limit', 20);

        for ($i = 0; $i < $limit; $i++) {
            $this->actingAs($student, 'api')
                ->postJson(self::ENDPOINT, ['message' => 'Hello ' . $i])
                ->assertStatus(200);
        }

        $this->actingAs($student, 'api')
            ->postJson(self::ENDPOINT, ['message' => 'One too many'])
            ->assertStatus(429);
    }

    public function test_reply_includes_three_follow_up_questions(): void
    {
        $this->fakeGeminiSuccess();

        $response = $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Hello'])
            ->assertStatus(200);

        $suggestions = $response->json('data.suggestions');

        $this->assertIsArray($suggestions);
        $this->assertCount(3, $suggestions);

        foreach ($suggestions as $suggestion) {
            $this->assertIsString($suggestion);
            $this->assertNotSame('', trim($suggestion));
        }
    }

    public function test_follow_up_questions_reflect_the_topic(): void
    {
        $this->fakeGeminiSuccess();

        $suggestions = $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Paano mag-book ng appointment?'])
            ->assertStatus(200)
            ->json('data.suggestions');

        $this->assertContains(
            'Paano ko makikita ang aking mga appointment?',
            $suggestions
        );
    }

    public function test_short_reply_reuses_the_previous_topic(): void
    {
        $this->fakeGeminiSuccess();

        $history = [
            ['role' => 'user', 'text' => 'Paano mag-book ng appointment?'],
            ['role' => 'assistant', 'text' => 'Buksan ang Appointments sa portal.'],
        ];

        $suggestions = $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'oo', 'history' => $history])
            ->assertStatus(200)
            ->json('data.suggestions');

        $this->assertContains(
            'Paano ko makikita ang aking mga appointment?',
            $suggestions
        );
    }

    public function test_degraded_reply_still_returns_follow_ups(): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(['error' => 'boom'], 500),
        ]);

        $response = $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Hello'])
            ->assertStatus(200)
            ->assertJson(['data' => ['degraded' => true]]);

        $this->assertCount(3, $response->json('data.suggestions'));
    }

    public function test_follow_up_questions_default_to_english(): void
    {
        $this->fakeGeminiSuccess();

        $suggestions = $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Hello'])
            ->assertStatus(200)
            ->json('data.suggestions');

        $this->assertContains('How do I book an appointment?', $suggestions);
    }

    public function test_follow_up_questions_switch_to_tagalog(): void
    {
        $this->fakeGeminiSuccess();

        $suggestions = $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Paano mag-book ng appointment?'])
            ->assertStatus(200)
            ->json('data.suggestions');

        $this->assertContains('Paano ko makikita ang aking mga appointment?', $suggestions);
        $this->assertNotContains('How do I see my appointments?', $suggestions);
    }
}
