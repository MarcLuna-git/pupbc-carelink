<?php

namespace App\Services\Chatbot;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Minimal client for the Google Gemini generateContent REST API.
 *
 * Deliberately never throws: callers get a result object and decide how to
 * degrade. A chatbot outage must not turn into a 500 for the student.
 *
 * Failures are classified with a `reason` code so the caller can tell a blocked
 * prompt apart from a provider outage and answer accordingly.
 */
class GeminiClient
{
    private const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent';

    private const FAILURE_COUNT_KEY = 'chatbot:gemini:failures';

    private const OPEN_UNTIL_KEY = 'chatbot:gemini:open_until';

    /**
     * Finish reasons that mean the model refused to answer.
     *
     * @var array<int, string>
     */
    private const BLOCKING_FINISH_REASONS = ['SAFETY', 'RECITATION', 'BLOCKLIST'];

    /**
     * @param  array<int, array{role: string, text: string}>  $messages
     * @return array{ok: bool, text: string, error: string|null, reason: string|null}
     */
    public function generate(string $systemPrompt, array $messages): array
    {
        $key = (string) config('services.gemini.key');

        if ($key === '') {
            return $this->failure('unconfigured', 'Gemini API key is not configured.');
        }

        if ($this->circuitIsOpen()) {
            return $this->failure('circuit_open', 'Gemini circuit breaker is open.');
        }

        $model = (string) config('services.gemini.model');
        $timeout = (int) config('services.gemini.timeout', 15);

        try {
            $response = Http::withHeaders([
                // Header auth keeps the key out of URLs, logs, and error traces.
                'x-goog-api-key' => $key,
            ])
                ->timeout($timeout)
                ->acceptJson()
                ->post(sprintf(self::ENDPOINT, $model), [
                    'systemInstruction' => [
                        'parts' => [
                            ['text' => $systemPrompt],
                        ],
                    ],
                    'contents' => $this->toContents($messages),
                    'generationConfig' => [
                        'temperature' => 0.3,
                        'maxOutputTokens' => (int) config('services.gemini.max_output_tokens', 1024),
                    ],
                    'safetySettings' => (array) config('services.gemini.safety_settings', []),
                ]);
        } catch (ConnectionException $e) {
            return $this->recordFailure('timeout', 'Gemini request timed out: ' . $e->getMessage());
        } catch (Throwable $e) {
            return $this->recordFailure('error', 'Gemini request failed: ' . $e->getMessage());
        }

        if ($response->failed()) {
            return $this->recordFailure('http', 'Gemini returned HTTP ' . $response->status());
        }

        $payload = $response->json();

        // A blocked prompt never reaches a candidate, so check it first.
        $blockReason = $payload['promptFeedback']['blockReason'] ?? null;

        if (is_string($blockReason) && $blockReason !== '') {
            return $this->failure('blocked', 'Gemini blocked the prompt: ' . $blockReason);
        }

        $finishReason = $payload['candidates'][0]['finishReason'] ?? null;
        $text = $this->extractText($payload);

        if (is_string($finishReason) && in_array($finishReason, self::BLOCKING_FINISH_REASONS, true)) {
            return $this->failure('safety', 'Gemini stopped the response: ' . $finishReason);
        }

        if ($text === '') {
            return $this->recordFailure('empty', 'Gemini returned an empty response.');
        }

        // A truncated answer is still useful, so it counts as a success. The
        // caller can surface the partial text rather than a generic error.
        $this->recordSuccess();

        return [
            'ok' => true,
            'text' => $text,
            'error' => null,
            'reason' => $finishReason === 'MAX_TOKENS' ? 'truncated' : null,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Circuit breaker
    |--------------------------------------------------------------------------
    */

    /**
     * True while the breaker is tripped, meaning Gemini should not be called.
     */
    private function circuitIsOpen(): bool
    {
        if (!config('chatbot.circuit_breaker.enabled', true)) {
            return false;
        }

        $openUntil = Cache::get(self::OPEN_UNTIL_KEY);

        return is_numeric($openUntil) && (int) $openUntil > time();
    }

    /**
     * Count a provider failure and trip the breaker once the threshold is hit.
     *
     * @return array{ok: bool, text: string, error: string, reason: string}
     */
    private function recordFailure(string $reason, string $error): array
    {
        if (config('chatbot.circuit_breaker.enabled', true)) {
            $cooldown = (int) config('chatbot.circuit_breaker.cooldown_seconds', 60);
            $threshold = (int) config('chatbot.circuit_breaker.failure_threshold', 5);

            $failures = (int) Cache::get(self::FAILURE_COUNT_KEY, 0) + 1;

            Cache::put(self::FAILURE_COUNT_KEY, $failures, $cooldown);

            if ($failures >= $threshold) {
                Cache::put(self::OPEN_UNTIL_KEY, time() + $cooldown, $cooldown);

                Log::warning('Chatbot circuit breaker opened', [
                    'failures' => $failures,
                    'cooldown_seconds' => $cooldown,
                ]);
            }
        }

        return $this->failure($reason, $error);
    }

    /**
     * Clear the breaker state after a healthy response.
     */
    private function recordSuccess(): void
    {
        Cache::forget(self::FAILURE_COUNT_KEY);
        Cache::forget(self::OPEN_UNTIL_KEY);
    }

    /**
     * Map our internal message shape onto Gemini's `contents` payload.
     *
     * @param  array<int, array{role: string, text: string}>  $messages
     * @return array<int, array{role: string, parts: array<int, array{text: string}>}>
     */
    private function toContents(array $messages): array
    {
        $contents = [];

        foreach ($messages as $message) {
            $text = trim((string) ($message['text'] ?? ''));

            if ($text === '') {
                continue;
            }

            $contents[] = [
                // Gemini only accepts "user" and "model".
                'role' => ($message['role'] ?? 'user') === 'assistant' ? 'model' : 'user',
                'parts' => [
                    ['text' => $text],
                ],
            ];
        }

        return $contents;
    }

    /**
     * Pull the first text part out of a generateContent response.
     *
     * @param  array<string, mixed>|null  $payload
     */
    private function extractText(?array $payload): string
    {
        $parts = $payload['candidates'][0]['content']['parts'] ?? [];

        if (!is_array($parts)) {
            return '';
        }

        $text = '';

        foreach ($parts as $part) {
            if (isset($part['text']) && is_string($part['text'])) {
                $text .= $part['text'];
            }
        }

        return trim($text);
    }

    /**
     * @return array{ok: bool, text: string, error: string, reason: string}
     */
    private function failure(string $reason, string $error): array
    {
        return ['ok' => false, 'text' => '', 'error' => $error, 'reason' => $reason];
    }
}
