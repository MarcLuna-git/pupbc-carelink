<?php

return [


    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // Ollama, used by the student clinic assistant.
    // The key stays server-side; it must never be exposed as a VITE_ variable.
    'ollama' => [
        'key' => env('OLLAMA_API_KEY'),
        'base_url' => env('OLLAMA_BASE_URL', 'https://ollama.com/v1'),
        'model' => env('OLLAMA_MODEL', 'gemma4:31b'),

        // Ordered fallback chain for OpenAI-compatible endpoint.
        'fallback_models' => array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env(
                'OLLAMA_FALLBACK_MODELS',
                'gemma4:31b'
            ))
        ))),

        // Seconds a model is skipped after it reports a rate limit. Set to 0 to
        // disable the skip and always try the full chain in order.
        'rate_limit_cooldown' => (int) env('OLLAMA_RATE_LIMIT_COOLDOWN', 60),

        // Kept below the frontend axios timeout (20s) so the student sees the
        // backend's graceful fallback instead of a raw network error.
        'timeout' => (int) env('OLLAMA_TIMEOUT', 30),

        'max_output_tokens' => (int) env('OLLAMA_MAX_OUTPUT_TOKENS', 1024),
    ],

    // Gemini: the clinic assistant's fallback when Ollama cannot answer (no
    // credits, rate limit, outage). Leave GEMINI_API_KEY empty to run with
    // Ollama only. Server-side only, never a VITE_ variable.
    'gemini' => [
        'key' => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL', 'gemini-3.5-flash-lite'),

        // Ordered model chain inside Gemini (rate limited / missing / 5xx models are skipped).
        'fallback_models' => array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env(
                'GEMINI_FALLBACK_MODELS',
                'gemini-3.1-flash-lite,gemma-4-26b-a4b-it,gemma-4-31b-it'
            ))
        ))),

        'rate_limit_cooldown' => (int) env('GEMINI_RATE_LIMIT_COOLDOWN', 60),

        // Ollama (up to OLLAMA_TIMEOUT) plus this stay under the frontend's
        // 60s chatbot request timeout.
        'timeout' => (int) env('GEMINI_TIMEOUT', 20),

        'max_output_tokens' => (int) env('GEMINI_MAX_OUTPUT_TOKENS', 1024),
    ],

];
