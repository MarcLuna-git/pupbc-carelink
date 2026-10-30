<?php

namespace App\Console\Commands;

use App\Services\Chatbot\GeminiClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Diagnoses the clinic assistant without opening the student portal: it shows
 * which key and models the app is actually using, asks Gemini whether the key
 * is accepted, and (optionally) sends one real test message.
 *
 * Run it after changing GEMINI_API_KEY or GEMINI_MODEL to confirm the change
 * took effect before blaming the widget.
 */
class CheckChatbot extends Command
{
    protected $signature = 'chatbot:check {--message= : Also send a test message to Gemini}';

    protected $description = 'Check the Gemini API key and model configuration used by the clinic chatbot.';

    public function handle(): int
    {
        $key = trim((string) config('services.gemini.key'));
        $primary = trim((string) config('services.gemini.model'));
        $fallbacks = array_values(array_filter(array_map(
            'trim',
            (array) config('services.gemini.fallback_models', [])
        )));

        $this->line('Chatbot enabled:  ' . (config('chatbot.enabled') ? 'yes' : 'no'));
        $this->line('Primary model:    ' . ($primary !== '' ? $primary : '(not set)'));
        $this->line('Fallback models:  ' . ($fallbacks !== [] ? implode(', ', $fallbacks) : '(none)'));
        $this->line('API key:          ' . $this->maskKey($key));

        if ($key === '') {
            $this->newLine();
            $this->error('GEMINI_API_KEY is empty.');
            $this->line('Set it in backend/.env, then run: php artisan config:clear');

            return self::FAILURE;
        }

        $this->newLine();
        $this->line('Asking Gemini whether this key is accepted ...');

        try {
            $response = Http::timeout(20)
                ->withHeaders(['x-goog-api-key' => $key])
                ->get('https://generativelanguage.googleapis.com/v1beta/models');
        } catch (Throwable $e) {
            $this->error('Could not reach Google: ' . $e->getMessage());

            return self::FAILURE;
        }

        if (! $response->successful()) {
            $status = $response->status();
            $message = $response->json('error.message') ?: trim($response->body());

            $this->error('Google rejected the request (HTTP ' . $status . '): ' . $message);

            if (in_array($status, [401, 403], true)) {
                $this->newLine();
                $this->warn('The key itself is not accepted by the Gemini API.');
                $this->line('1. Create a fresh key at https://aistudio.google.com/apikey');
                $this->line('2. Put it in backend/.env as GEMINI_API_KEY=... (and in the Render dashboard for production)');
                $this->line('3. Run: php artisan config:clear');
            }

            return self::FAILURE;
        }

        $models = collect($response->json('models', []))
            ->filter(function ($model) {
                return in_array('generateContent', (array) ($model['supportedGenerationMethods'] ?? []), true);
            })
            ->map(function ($model) {
                return preg_replace('#^models/#', '', (string) ($model['name'] ?? ''));
            })
            ->filter()
            ->values();

        $this->info('Key accepted. Models that can answer: ' . $models->count());

        $chain = array_values(array_filter(array_unique(array_merge([$primary], $fallbacks))));

        foreach ($chain as $model) {
            $this->line(($models->contains($model) ? '  [ok]      ' : '  [missing] ') . $model);
        }

        if (! $models->contains($primary)) {
            $this->warn('The primary model is not in that list. Set GEMINI_MODEL to an available model.');
        }

        $message = trim((string) $this->option('message'));

        if ($message !== '') {
            $this->newLine();
            $this->line('Sending a test message ...');

            $result = app(GeminiClient::class)->generate(
                'You are a test. Answer in one short sentence.',
                [['role' => 'user', 'text' => $message]]
            );

            if (! $result['ok']) {
                $this->error('Gemini failed: ' . $result['error']);

                return self::FAILURE;
            }

            $this->info('Reply: ' . $result['text']);
        }

        return self::SUCCESS;
    }

    private function maskKey(string $key): string
    {
        if ($key === '') {
            return '(empty)';
        }

        if (strlen($key) <= 12) {
            return str_repeat('*', strlen($key));
        }

        return substr($key, 0, 8) . '...' . substr($key, -4) . ' (' . strlen($key) . ' chars)';
    }
}
