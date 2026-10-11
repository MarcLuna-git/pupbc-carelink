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

    // Google Gemini, used by the student clinic assistant.
    // The key stays server-side; it must never be exposed as a VITE_ variable.
    'gemini' => [
        'key' => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL', 'gemini-3.5-flash-lite'),

        // Ordered fallback chain. When a model is rate limited (HTTP 429), not
        // found, or briefly unavailable (5xx), the client moves to the next
        // entry. Order matters: the first model that answers wins. After a 429
        // a model is skipped for `rate_limit_cooldown` seconds so traffic
        // naturally cycles through the whole list and then back to the start.
        //
        // Comma-separated. Verified live against generativelanguage ListModels:
        // all four support generateContent.
        'fallback_models' => array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env(
                'GEMINI_FALLBACK_MODELS',
                'gemini-3.1-flash-lite,gemma-4-26b-a4b-it,gemma-4-31b-it'
            ))
        ))),

        // Seconds a model is skipped after it reports a rate limit. Set to 0 to
        // disable the skip and always try the full chain in order.
        'rate_limit_cooldown' => (int) env('GEMINI_RATE_LIMIT_COOLDOWN', 60),

        // Kept below the frontend axios timeout (20s) so the student sees the
        // backend's graceful fallback instead of a raw network error.
        'timeout' => (int) env('GEMINI_TIMEOUT', 15),

        'max_output_tokens' => (int) env('GEMINI_MAX_OUTPUT_TOKENS', 1024),

        // Explicit thresholds rather than Gemini's defaults. Dangerous content
        // is relaxed to BLOCK_ONLY_HIGH so a clinic assistant can still discuss
        // symptoms and first aid without tripping the filter.
        'safety_settings' => [
            [
                'category' => 'HARM_CATEGORY_HARASSMENT',
                'threshold' => 'BLOCK_MEDIUM_AND_ABOVE',
            ],
            [
                'category' => 'HARM_CATEGORY_HATE_SPEECH',
                'threshold' => 'BLOCK_MEDIUM_AND_ABOVE',
            ],
            [
                'category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                'threshold' => 'BLOCK_MEDIUM_AND_ABOVE',
            ],
            [
                'category' => 'HARM_CATEGORY_DANGEROUS_CONTENT',
                'threshold' => 'BLOCK_ONLY_HIGH',
            ],
        ],
    ],

];
