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

];
