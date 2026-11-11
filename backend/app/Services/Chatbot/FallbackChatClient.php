<?php

namespace App\Services\Chatbot;

use Illuminate\Support\Facades\Log;

/**
 * The clinic assistant's provider chain: Ollama first, Gemini when Ollama
 * cannot answer (no credits / HTTP 402, rate limit, outage, timeout, missing
 * key or an open circuit breaker). Each client keeps its own model chain and
 * circuit breaker, so a failing Ollama is skipped quickly while it cools down.
 *
 * Like the clients, it never throws: the caller always gets a result array.
 */
class FallbackChatClient
{
    /**
     * A content refusal is not an outage; the other provider would be asked
     * the same prompt, so it is returned as is.
     *
     * @var array<int, string>
     */
    private const CONTENT_REFUSAL_REASONS = ['blocked', 'safety'];

    private OllamaClient $primary;

    private GeminiClient $fallback;

    public function __construct(OllamaClient $primary, GeminiClient $fallback)
    {
        $this->primary = $primary;
        $this->fallback = $fallback;
    }

    /**
     * @param  array<int, array{role: string, text: string}>  $messages
     * @return array{ok: bool, text: string, error: string|null, reason: string|null}
     */
    public function generate(string $systemPrompt, array $messages, bool $json = false): array
    {
        $first = $this->primary->generate($systemPrompt, $messages, $json);

        if ($first['ok'] || in_array($first['reason'], self::CONTENT_REFUSAL_REASONS, true)) {
            return $first;
        }

        $second = $this->fallback->generate($systemPrompt, $messages, $json);

        if ($second['ok']) {
            Log::info('Chatbot answered by the fallback provider (Gemini)', [
                'ollama_reason' => $first['reason'],
                'ollama_error' => $first['error'],
            ]);

            return $second;
        }

        // No Gemini key: the fallback is simply not set up, so the student's
        // reply should explain Ollama's failure, not Gemini's.
        if ($second['reason'] === 'unconfigured') {
            return $first;
        }

        Log::warning('Chatbot fallback provider (Gemini) also failed', [
            'ollama_reason' => $first['reason'],
            'gemini_reason' => $second['reason'],
            'gemini_error' => $second['error'],
        ]);

        // Report the primary's reason unless Ollama was the one not set up.
        return $first['reason'] === 'unconfigured' ? $second : $first;
    }
}
