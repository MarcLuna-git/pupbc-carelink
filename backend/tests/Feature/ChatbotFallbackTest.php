<?php

namespace Tests\Feature;

use App\Services\Chatbot\FallbackChatClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

// Ollama first, Gemini when Ollama cannot answer. Every request is faked: a
// test must never reach a real provider (it spends paid credits).
class ChatbotFallbackTest extends TestCase
{
    private const OLLAMA = 'https://ollama.test/v1/*';

    private const GEMINI = 'generativelanguage.googleapis.com/*';

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        config([
            'services.ollama.key' => 'test-ollama-key',
            'services.ollama.base_url' => 'https://ollama.test/v1',
            'services.ollama.model' => 'ollama-model',
            'services.ollama.fallback_models' => [],
            'services.gemini.key' => 'test-gemini-key',
            'services.gemini.model' => 'gemini-model',
            'services.gemini.fallback_models' => [],
        ]);
    }

    private function reply(string $text): array
    {
        return ['choices' => [['message' => ['content' => $text], 'finish_reason' => 'stop']]];
    }

    private function ask(): array
    {
        return app(FallbackChatClient::class)->generate('system', [['role' => 'user', 'text' => 'Hello?']]);
    }

    private function sentTo(string $host): int
    {
        return count(Http::recorded(fn (Request $request) => str_contains($request->url(), $host)));
    }

    public function test_ollama_answers_and_gemini_is_not_called(): void
    {
        Http::fake([self::OLLAMA => Http::response($this->reply('from ollama')), '*' => Http::response([], 500)]);

        $result = $this->ask();

        $this->assertTrue($result['ok']);
        $this->assertSame('from ollama', $result['text']);
        $this->assertSame(0, $this->sentTo('googleapis'));
    }

    public function test_ollama_without_credits_falls_back_to_gemini(): void
    {
        Http::fake([
            self::OLLAMA => Http::response(['error' => ['message' => 'Add usage credits']], 402),
            self::GEMINI => Http::response($this->reply('from gemini')),
            '*' => Http::response([], 500),
        ]);

        $result = $this->ask();

        $this->assertTrue($result['ok']);
        $this->assertSame('from gemini', $result['text']);
        $this->assertSame(1, $this->sentTo('ollama.test'));
        $this->assertSame(1, $this->sentTo('googleapis'));
    }

    public function test_rate_limited_ollama_falls_back_to_gemini(): void
    {
        Http::fake([
            self::OLLAMA => Http::response([], 429),
            self::GEMINI => Http::response($this->reply('from gemini')),
            '*' => Http::response([], 500),
        ]);

        $this->assertSame('from gemini', $this->ask()['text']);
    }

    public function test_missing_ollama_key_uses_gemini(): void
    {
        config(['services.ollama.key' => '']);
        Http::fake([self::GEMINI => Http::response($this->reply('from gemini')), '*' => Http::response([], 500)]);

        $this->assertSame('from gemini', $this->ask()['text']);
        $this->assertSame(0, $this->sentTo('ollama.test'));
    }

    public function test_a_content_refusal_is_not_sent_to_gemini(): void
    {
        Http::fake([
            self::OLLAMA => Http::response(['choices' => [['message' => ['content' => ''], 'finish_reason' => 'content_filter']]]),
            '*' => Http::response($this->reply('should not be used')),
        ]);

        $result = $this->ask();

        $this->assertFalse($result['ok']);
        $this->assertSame('safety', $result['reason']);
        $this->assertSame(0, $this->sentTo('googleapis'));
    }

    public function test_without_a_gemini_key_the_ollama_failure_is_reported(): void
    {
        config(['services.gemini.key' => '']);
        Http::fake([self::OLLAMA => Http::response([], 402), '*' => Http::response([], 500)]);

        $result = $this->ask();

        $this->assertFalse($result['ok']);
        $this->assertSame('http', $result['reason']);
        $this->assertStringContainsString('Ollama', $result['error']);
        $this->assertSame(0, $this->sentTo('googleapis'));
    }

    public function test_both_failing_reports_the_ollama_reason(): void
    {
        Http::fake([self::OLLAMA => Http::response([], 402), self::GEMINI => Http::response([], 503), '*' => Http::response([], 500)]);

        $result = $this->ask();

        $this->assertFalse($result['ok']);
        $this->assertSame('http', $result['reason']);
    }
}
