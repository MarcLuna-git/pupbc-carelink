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
        $this->fakeGeminiSuccess('The clinic is open from 8:00 AM to 5:00 PM.');

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'What time does the clinic open?'])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'reply' => 'The clinic is open from 8:00 AM to 5:00 PM.',
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
            ->postJson(self::ENDPOINT, ['message' => 'How do I book an appointment?'])
            ->assertStatus(200)
            ->json('data.suggestions');

        $this->assertContains(
            'How do I see my appointments?',
            $suggestions
        );
    }

    public function test_short_reply_reuses_the_previous_topic(): void
    {
        $this->fakeGeminiSuccess();

        $history = [
            ['role' => 'user', 'text' => 'How do I book an appointment?'],
            ['role' => 'assistant', 'text' => 'Open Appointments in the student portal.'],
        ];

        $suggestions = $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'ok', 'history' => $history])
            ->assertStatus(200)
            ->json('data.suggestions');

        $this->assertContains(
            'How do I see my appointments?',
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

    public function test_reply_and_follow_ups_use_the_students_language(): void
    {
        $this->fakeGeminiSuccess(json_encode([
            'reply' => 'Bukas ang clinic mula 8:00 AM hanggang 5:00 PM.',
            'suggestions' => [
                'Paano ako mag-book ng appointment?',
                'Anong mga serbisyo ang available?',
                'Paano ko makokontak ang clinic?',
            ],
        ]));

        $response = $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Anong oras bukas ang clinic?'])
            ->assertStatus(200);

        $this->assertSame(
            'Bukas ang clinic mula 8:00 AM hanggang 5:00 PM.',
            $response->json('data.reply')
        );

        $this->assertSame(
            [
                'Paano ako mag-book ng appointment?',
                'Anong mga serbisyo ang available?',
                'Paano ko makokontak ang clinic?',
            ],
            $response->json('data.suggestions')
        );
    }

    public function test_reply_unwraps_json_inside_a_markdown_fence(): void
    {
        $this->fakeGeminiSuccess(
            "```json\n" . json_encode([
                'reply' => 'The clinic is open from 8:00 AM to 5:00 PM.',
                'suggestions' => [
                    'How do I book an appointment?',
                    'What services are available?',
                    'How can I contact the clinic?',
                ],
            ]) . "\n```"
        );

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'What time does the clinic open?'])
            ->assertStatus(200)
            ->assertJson([
                'data' => ['reply' => 'The clinic is open from 8:00 AM to 5:00 PM.'],
            ]);
    }

    public function test_truncated_json_reply_is_recovered_as_plain_text(): void
    {
        // A MAX_TOKENS finish can cut the JSON mid-string; the reply text must
        // still reach the student instead of a raw JSON fragment.
        $this->fakeGeminiSuccess('{"reply": "The clinic is open from 8:00 AM');

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'What time does the clinic open?'])
            ->assertStatus(200)
            ->assertJson([
                'data' => ['reply' => 'The clinic is open from 8:00 AM'],
            ]);
    }

    public function test_json_response_mode_is_requested_from_gemini(): void
    {
        $this->fakeGeminiSuccess();

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Hello'])
            ->assertStatus(200);

        Http::assertSent(function ($request) {
            return ($request->data()['generationConfig']['responseMimeType'] ?? null) === 'application/json';
        });
    }

    public function test_system_prompt_asks_the_model_to_refuse_in_the_students_language(): void
    {
        $this->fakeGeminiSuccess();

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Who was the president of the Philippines in 2010?'])
            ->assertStatus(200);

        $prompt = '';

        Http::assertSent(function ($request) use (&$prompt) {
            $prompt = $request['systemInstruction']['parts'][0]['text'] ?? '';

            return true;
        });

        // The refusal must be written in the student's language rather than a
        // single hardcoded English sentence.
        $this->assertStringContainsString("in the same language as the student's message", $prompt);
        $this->assertStringNotContainsString('put exactly this text in', $prompt);
    }

    public function test_blocked_fallback_is_bilingual(): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'promptFeedback' => ['blockReason' => 'PROHIBITED_CONTENT'],
            ]),
        ]);

        $reply = $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Hello'])
            ->assertStatus(200)
            ->json('data.reply');

        $this->assertStringContainsString('Sorry, I can\'t help you with that.', $reply);
        $this->assertStringContainsString('Paumanhin', $reply);
    }

    public function test_previously_offered_follow_ups_are_sent_back_to_the_model(): void
    {
        $this->fakeGeminiSuccess();

        $history = [
            ['role' => 'user', 'text' => 'How do I book an appointment?'],
            [
                'role' => 'assistant',
                'text' => 'Open Appointments in the student portal.',
                'suggestions' => [
                    'How do I see my appointments?',
                    'When can I check in with my QR code?',
                    'What services are available?',
                ],
            ],
        ];

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, [
                'message' => 'ok',
                'history' => $history,
            ])
            ->assertStatus(200);

        $prompt = '';

        Http::assertSent(function ($request) use (&$prompt) {
            $prompt = $request['systemInstruction']['parts'][0]['text'] ?? '';

            return true;
        });

        $this->assertStringContainsString('BEGIN PREVIOUS FOLLOW-UP QUESTIONS', $prompt);
        $this->assertStringContainsString('How do I see my appointments?', $prompt);
        $this->assertStringContainsString('When can I check in with my QR code?', $prompt);
    }

    public function test_too_many_follow_ups_in_history_are_rejected(): void
    {
        $this->fakeGeminiSuccess();

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, [
                'message' => 'Hello',
                'history' => [
                    [
                        'role' => 'assistant',
                        'text' => 'Hello!',
                        'suggestions' => ['a', 'b', 'c', 'd', 'e', 'f'],
                    ],
                ],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('history.0.suggestions');
    }

    public function test_third_follow_up_reuses_a_skipped_question(): void
    {
        $this->fakeGeminiSuccess(
            '{"reply":"Here you go.","suggestions":["Fresh one?","Fresh two?","Fresh three?"]}'
        );

        $history = [
            ['role' => 'user', 'text' => 'Hi'],
            [
                'role' => 'assistant',
                'text' => 'Hello!',
                'suggestions' => ['Old A?', 'Old B?', 'Old C?'],
            ],
            ['role' => 'user', 'text' => 'What services are there?'],
            [
                'role' => 'assistant',
                'text' => 'We offer several.',
                'suggestions' => ['Recent A?', 'Recent B?', 'Recent C?'],
            ],
        ];

        $response = $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, [
                'message' => 'ok',
                'history' => $history,
            ])
            ->assertStatus(200);

        $this->assertSame(
            ['Fresh one?', 'Fresh two?', 'Old A?'],
            $response->json('data.suggestions')
        );
    }

    public function test_third_follow_up_does_not_reuse_an_asked_question(): void
    {
        $this->fakeGeminiSuccess(
            '{"reply":"Here you go.","suggestions":["Fresh one?","Fresh two?","Fresh three?"]}'
        );

        $history = [
            ['role' => 'user', 'text' => 'Hi'],
            [
                'role' => 'assistant',
                'text' => 'Hello!',
                'suggestions' => ['Old A?', 'Old B?', 'Old C?'],
            ],
            ['role' => 'user', 'text' => 'Old A?'],
            [
                'role' => 'assistant',
                'text' => 'We offer several.',
                'suggestions' => ['Recent A?', 'Recent B?', 'Recent C?'],
            ],
        ];

        $response = $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, [
                'message' => 'ok',
                'history' => $history,
            ])
            ->assertStatus(200);

        $this->assertSame(
            ['Fresh one?', 'Fresh two?', 'Old B?'],
            $response->json('data.suggestions')
        );
    }

    public function test_reference_data_carries_the_clinic_schedule(): void
    {
        $this->fakeGeminiSuccess();

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'What is the schedule of the clinic campus?'])
            ->assertStatus(200);

        $prompt = '';

        Http::assertSent(function ($request) use (&$prompt) {
            $prompt = $request['systemInstruction']['parts'][0]['text'] ?? '';

            return true;
        });

        // The clinic is not open 24/7, so the model must know it is closed on
        // Sundays and can answer the campus schedule question.
        $this->assertStringContainsString('Open days: Monday to Saturday', $prompt);
        $this->assertStringContainsString('Closed on: Sunday', $prompt);
        $this->assertStringContainsString('What is the schedule of the clinic campus?', $prompt);
    }
}
