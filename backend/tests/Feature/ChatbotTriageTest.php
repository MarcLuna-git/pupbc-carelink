<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Symptom categorization + triage.
 *
 * The assistant reports a category, a severity, and any red flags it heard.
 * The backend then labels the reply with a triage level using the same
 * severity/red-flag rules as the kiosk. These tests cover the end-to-end
 * pipeline through the real endpoint, mirroring the scenario table agreed with
 * the clinic: a mild headache stays low, a persist/re-assess turn escalates,
 * an emergency is flagged immediately, and a booking or clinic-hours question
 * never gets a badge.
 */
class ChatbotTriageTest extends TestCase
{
    use DatabaseTransactions;

    private const ENDPOINT = '/api/student/chatbot/message';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.gemini.key' => 'test-gemini-key',
            'chatbot.enabled' => true,
            'chatbot.triage.enabled' => true,
        ]);
    }

    private function student(): User
    {
        return User::create([
            'student_id' => 'STUDENT-' . Str::random(10),
            'first_name' => 'Student',
            'last_name' => 'Test',
            'email' => Str::uuid() . '@example.test',
            'password' => Hash::make('TestPassword123!'),
            'birthday' => '2002-05-15',
            'role' => 'student',
            'status' => null,
        ]);
    }

    /**
     * Fake a successful structured reply with a symptom report.
     */
    private function fakeGeminiReply(array $symptom, string $reply = 'Here is some guidance.'): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [[
                                'text' => json_encode([
                                    'reply' => $reply,
                                    'symptom' => $symptom,
                                    'suggestions' => [
                                        'May lagnat ka ba?',
                                        'Ilang araw na ito?',
                                        'Ano ang oras ng clinic?',
                                    ],
                                ]),
                            ]],
                        ],
                    ],
                ],
            ]),
        ]);
    }

    public function test_mild_headache_is_labelled_low(): void
    {
        $this->fakeGeminiReply([
            'category' => 'headache',
            'severity' => 'mild',
            'red_flags' => [],
        ]);

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Masakit ulo ko, puyat ako kagabi.'])
            ->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'symptom' => ['category' => 'headache', 'severity' => 'mild'],
                    'triage' => ['level' => 'LOW', 'color' => 'green'],
                    'recommendation' => 'book_consultation',
                ],
            ]);
    }

    public function test_explaining_common_causes_keeps_the_category(): void
    {
        $this->fakeGeminiReply([
            'category' => 'headache',
            'severity' => 'mild',
            'red_flags' => [],
        ]);

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Bakit kaya masakit ulo ko?'])
            ->assertStatus(200)
            ->assertJsonPath('data.triage.level', 'LOW')
            ->assertJsonPath('data.symptom.category', 'headache');
    }

    public function test_reassessment_escalates_the_level(): void
    {
        // Turn 2: the student reported back that rest and fluids did not help.
        $history = [
            ['role' => 'user', 'text' => 'Masakit ulo ko, puyat ako kagabi.'],
            ['role' => 'assistant', 'text' => 'Try to rest and drink water.'],
        ];

        $this->fakeGeminiReply([
            'category' => 'headache',
            'severity' => 'moderate',
            'red_flags' => [],
        ]);

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, [
                'message' => 'Uminom na ako ng tubig pero hindi pa rin nawawala.',
                'history' => $history,
            ])
            ->assertStatus(200)
            ->assertJson([
                'data' => [
                    'triage' => ['level' => 'MEDIUM', 'color' => 'yellow'],
                    'recommendation' => 'book_same_day',
                ],
            ]);
    }

    public function test_severe_but_unconfirmed_pain_stays_medium_for_red_flag_check(): void
    {
        $this->fakeGeminiReply([
            'category' => 'headache',
            'severity' => 'moderate',
            'red_flags' => [],
        ]);

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Sobrang sakit ng ulo ko.'])
            ->assertStatus(200)
            ->assertJsonPath('data.triage.level', 'MEDIUM');
    }

    public function test_emergency_red_flag_is_flagged_high_and_go_now(): void
    {
        $this->fakeGeminiReply([
            'category' => 'headache',
            'severity' => 'severe',
            'red_flags' => ['sudden_severe_headache'],
        ]);

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, [
                'message' => 'Bigla akong nakaramdam ng pinakamatinding headache sa buhay ko.',
            ])
            ->assertStatus(200)
            ->assertJson([
                'data' => [
                    'triage' => ['level' => 'HIGH', 'color' => 'red'],
                    'recommendation' => 'go_now',
                ],
            ]);
    }

    public function test_severe_severity_alone_is_high(): void
    {
        // Mirrors the kiosk: severe/critical severity is HIGH even without a
        // discrete red flag.
        $this->fakeGeminiReply([
            'category' => 'respiratory',
            'severity' => 'severe',
            'red_flags' => [],
        ]);

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Sobrang hirap ng paghinga ko.'])
            ->assertStatus(200)
            ->assertJsonPath('data.triage.level', 'HIGH')
            ->assertJsonPath('data.recommendation', 'go_now');
    }

    public function test_booking_intent_has_no_triage(): void
    {
        $this->fakeGeminiReply([
            'category' => 'none',
            'severity' => null,
            'red_flags' => [],
        ]);

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Pwede bang magpa-check sa clinic?'])
            ->assertStatus(200)
            ->assertJsonPath('data.triage', null)
            ->assertJsonPath('data.recommendation', null)
            ->assertJsonPath('data.symptom.category', 'none');
    }

    public function test_clinic_hours_question_is_never_forced_into_assessment(): void
    {
        $this->fakeGeminiReply([
            'category' => 'none',
            'severity' => null,
            'red_flags' => [],
        ]);

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Ano oras bukas ang clinic?'])
            ->assertStatus(200)
            ->assertJsonPath('data.triage', null);
    }

    public function test_unrecognised_category_falls_back_to_other(): void
    {
        // The model can name a symptom we have no bucket for — for example
        // "toothache" instead of "dental". Rather than lose the badge, keep it
        // as "other" so the reply is still triaged.
        $this->fakeGeminiReply([
            'category' => 'toothache',
            'severity' => 'severe',
            'red_flags' => ['whatever'],
        ]);

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Masakit ang ngipin ko.'])
            ->assertStatus(200)
            ->assertJsonPath('data.symptom.category', 'other')
            ->assertJsonPath('data.triage.level', 'HIGH');
    }

    public function test_triage_can_be_disabled(): void
    {
        config(['chatbot.triage.enabled' => false]);

        $this->fakeGeminiReply([
            'category' => 'headache',
            'severity' => 'severe',
            'red_flags' => ['seizure'],
        ]);

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Masakit ulo ko.'])
            ->assertStatus(200)
            ->assertJsonPath('data.triage', null)
            ->assertJsonPath('data.recommendation', null);
    }

    public function test_degraded_reply_has_no_triage(): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(['error' => 'boom'], 500),
        ]);

        $this->actingAs($this->student(), 'api')
            ->postJson(self::ENDPOINT, ['message' => 'Masakit ulo ko.'])
            ->assertStatus(200)
            ->assertJson([
                'data' => ['degraded' => true, 'triage' => null, 'recommendation' => null],
            ]);
    }
}
