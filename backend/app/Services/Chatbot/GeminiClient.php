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
 * The client walks an ordered list of models (the configured primary followed
 * by its fallbacks). A rate limited (429), missing (404), or briefly overloaded
 * (5xx) model is skipped for the next one, so a single exhausted quota does not
 * take the assistant down.
 *
 * Failures are classified with a `reason` code so the caller can tell a blocked
 * prompt apart from a provider outage and answer accordingly.
 */
class GeminiClient
{
    private const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent';

    private const FAILURE_COUNT_KEY = 'chatbot:gemini:failures';

    private const OPEN_UNTIL_KEY = 'chatbot:gemini:open_until';

    private const RATE_LIMIT_KEY_PREFIX = 'chatbot:gemini:rate_limited:';

    /**
     * Finish reasons that mean the model refused to answer.
     *
     * @var array<int, string>
     */
    private const BLOCKING_FINISH_REASONS = ['SAFETY', 'RECITATION', 'BLOCKLIST'];

    /**
     * Failures that are worth retrying on the next model in the chain: the
     * model is rate limited, gone, or briefly overloaded.
     *
     * @var array<int, string>
     */
    private const FAILOVER_REASONS = ['rate_limit', 'not_found', 'server_error'];

    /**
     * A content refusal is not a provider outage: it must not trip the circuit
     * breaker, and every model would refuse the same prompt alike.
     *
     * @var array<int, string>
     */
    private const CONTENT_REFUSAL_REASONS = ['blocked', 'safety'];

    /**
     * @param  array<int, array{role: string, text: string}>  $messages
     * @param  bool  $json  Ask the provider for a JSON response body.
     * @return array{ok: bool, text: string, error: string|null, reason: string|null}
     */
    public function generate(string $systemPrompt, array $messages, bool $json = false): array
    {
        $key = (string) config('services.gemini.key');

        if ($key === '') {
            return $this->failure('unconfigured', 'Gemini API key is not configured.');
        }

        if ($this->circuitIsOpen()) {
            return $this->failure('circuit_open', 'Gemini circuit breaker is open.');
        }

        $timeout = (int) config('services.gemini.timeout', 15);
        $cooldown = (int) config('services.gemini.rate_limit_cooldown', 60);
        $lastFailure = null;

        foreach ($this->modelsToTry() as $model) {
            $result = $this->attempt($key, $model, $systemPrompt, $messages, $json, $timeout);

            if ($result['ok']) {
                Cache::forget($this->rateLimitKey($model));
                $this->recordSuccess();

                return $result;
            }

            if (in_array($result['reason'], self::CONTENT_REFUSAL_REASONS, true)) {
                return $result;
            }

            if (in_array($result['reason'], self::FAILOVER_REASONS, true)) {
                $lastFailure = $result;

                if ($result['reason'] === 'rate_limit' && $cooldown > 0) {
                    Cache::put($this->rateLimitKey($model), time(), $cooldown);
                }

                Log::warning('Chatbot model failed; trying the next one', [
                    'model' => $model,
                    'reason' => $result['reason'],
                ]);

                continue;
            }

            // Any other failure (timeout, bad request, empty response, ...)
            // would repeat on every model, so count it and stop.
            $this->recordFailure((string) $result['reason'], (string) $result['error']);

            return $result;
        }

        $failure = $lastFailure ?? $this->failure('unavailable', 'No Gemini model could answer.');

        $this->recordFailure((string) $failure['reason'], (string) $failure['error']);

        return $failure;
    }

    /**
     * Call one model once. Never touches the circuit breaker; the caller owns
     * the retry and accounting policy.
     *
     * @param  array<int, array{role: string, text: string}>  $messages
     * @return array{ok: bool, text: string, error: string|null, reason: string|null}
     */
    private function attempt(string $key, string $model, string $systemPrompt, array $messages, bool $json, int $timeout): array
    {
        $generationConfig = [
            'temperature' => 0.3,
            'maxOutputTokens' => (int) config('services.gemini.max_output_tokens', 1024),
        ];

        if ($json) {
            $generationConfig['responseMimeType'] = 'application/json';
        }

        try {
            $response = Http::timeout($timeout)
                ->withHeaders(['x-goog-api-key' => $key])
                ->post(
                    sprintf(self::ENDPOINT, $model),
                    [
                        'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
                        'contents' => $this->toContents($messages),
                        'generationConfig' => $generationConfig,
                        'safetySettings' => (array) config('services.gemini.safety_settings', []),
                    ]
                );
        } catch (ConnectionException $e) {
            return $this->failure('timeout', 'Gemini request timed out: ' . $e->getMessage());
        } catch (Throwable $e) {
            return $this->failure('error', 'Gemini request failed: ' . $e->getMessage());
        }

        $status = $response->status();

        if ($status === 429) {
            return $this->failure('rate_limit', 'Gemini rate limited the request (HTTP 429).');
        }

        if ($status === 404) {
            return $this->failure('not_found', 'Gemini model was not found: ' . $model);
        }

        if ($status >= 500) {
            return $this->failure('server_error', 'Gemini reported a server error (HTTP ' . $status . ').');
        }

        if (! $response->successful()) {
            return $this->failure('http', 'Gemini request failed (HTTP ' . $status . ').');
        }

        $payload = $response->json();

        // The prompt was rejected before any candidate was produced.
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
            return $this->failure('empty', 'Gemini returned an empty response.');
        }

        // A truncated answer is still useful, so it counts as a success. The
        // caller can surface the partial text rather than a generic error.
        return [
            'ok' => true,
            'text' => $text,
            'error' => null,
            'reason' => $finishReason === 'MAX_TOKENS' ? 'truncated' : null,
        ];
    }

    /**
     * The ordered models to try for this request.
     *
     * Models that recently returned a rate limit are skipped here, so traffic
     * cycles to the next one. If every model is cooling down we still try them
     * all rather than failing outright, because the cooldown is only a hint.
     *
     * @return array<int, string>
     */
    private function modelsToTry(): array
    {
        $primary = trim((string) config('services.gemini.model'));
        $fallbacks = array_map('trim', (array) config('services.gemini.fallback_models', []));

        $chain = array_values(array_filter(
            array_unique(array_merge([$primary], $fallbacks)),
            static fn (string $model): bool => $model !== ''
        ));

        $cooldown = (int) config('services.gemini.rate_limit_cooldown', 60);

        if ($cooldown <= 0) {
            return $chain;
        }

        $ready = array_values(array_filter(
            $chain,
            fn (string $model): bool => ! Cache::has($this->rateLimitKey($model))
        ));

        return $ready !== [] ? $ready : $chain;
    }

    private function rateLimitKey(string $model): string
    {
        return self::RATE_LIMIT_KEY_PREFIX . $model;
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
     * Pull the answer text out of a generateContent response.
     *
     * Thinking models (Gemma 4, Gemini thinking variants) return their
     * reasoning as a part flagged `thought: true` before the real answer, so
     * those parts are skipped rather than concatenated into the reply.
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
            if (($part['thought'] ?? false) === true) {
                continue;
            }

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
