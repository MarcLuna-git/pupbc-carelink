<?php

namespace App\Services\Chatbot;

/**
 * Labels the assistant's symptom report with a triage level.
 *
 * The model only says what it heard (a category, a severity, and any red
 * flags). This class owns the decision, using the same severity and red-flag
 * rules as the kiosk (KioskController::triagePriority), so a student never
 * gets a different urgency from the chat than they would from check-in.
 *
 * The result is advisory only. It guides the student and colours the badge in
 * the widget; the nurse still confirms the real triage at the clinic. A
 * message that is not about the student's own symptoms (a booking or clinic
 * question, a greeting) carries the category "none" and is deliberately left
 * without a level, so no badge is shown.
 */
class SymptomTriage
{
    /**
     * Build the triage label for one assistant turn.
     *
     * @param  array<string, mixed>  $symptom
     * @return array{level: string, color: string, label: string, recommendation: string}|null
     */
    public function classify(array $symptom): ?array
    {
        if (!config('chatbot.triage.enabled', true)) {
            return null;
        }

        $normalized = $this->normalize($symptom);

        if ($normalized['category'] === 'none') {
            return null;
        }

        $level = $this->level($normalized['severity'], $normalized['red_flags']);
        $labels = (array) config('chatbot.triage.levels.' . $level, []);

        return [
            'level' => $level,
            'color' => (string) ($labels['color'] ?? 'green'),
            'label' => (string) ($labels['label'] ?? ''),
            'recommendation' => (string) ($labels['recommendation'] ?? ''),
        ];
    }

    /**
     * Coerce the model's raw report into the shape the widget stores, so a
     * stray category or severity never leaks through to the frontend.
     *
     * @param  mixed  $symptom
     * @return array{category: string, severity: string|null, red_flags: array<int, string>}
     */
    public function normalize(mixed $symptom): array
    {
        $symptom = is_array($symptom) ? $symptom : [];

        $severity = $this->severity($symptom['severity'] ?? null);
        $redFlags = $this->redFlags($symptom['red_flags'] ?? null);
        $category = $this->category($symptom['category'] ?? null);

        // The model named a symptom but not one we recognise (for example
        // "toothache" instead of "dental"). Keep it as "other" so the reply
        // still gets a badge, instead of silently vanishing into "none".
        if ($category === null && $this->reportsSymptom($symptom, $severity, $redFlags)) {
            $category = 'other';
        }

        return [
            'category' => $category ?? 'none',
            'severity' => $severity,
            'red_flags' => $redFlags,
        ];
    }

    /**
     * Whether the model reported a symptom even though its category did not
     * match one we know. An explicit "none" is respected; a missing category
     * falls back to the severity and red-flag signal.
     *
     * @param  array<string, mixed>  $symptom
     * @param  array<int, string>  $redFlags
     */
    private function reportsSymptom(array $symptom, ?string $severity, array $redFlags): bool
    {
        $category = $symptom['category'] ?? null;

        if (is_string($category)) {
            $category = strtolower(trim($category));

            if ($category === 'none') {
                return false;
            }

            if ($category !== '') {
                return true;
            }
        }

        return $severity !== null || $redFlags !== [];
    }

    /**
     * Severity plus red flags -> level, matching the kiosk rules: any red flag
     * or a severe/critical severity is HIGH, moderate is MEDIUM, the rest LOW.
     *
     * @param  array<int, string>  $redFlags
     */
    private function level(?string $severity, array $redFlags): string
    {
        if ($redFlags !== []) {
            return 'HIGH';
        }

        $levels = (array) config('chatbot.triage.severity_levels', []);

        return (string) ($levels[$severity] ?? 'LOW');
    }

    /**
     * Keep the category only when it is one the config allows.
     */
    private function category(mixed $category): ?string
    {
        if (!is_string($category)) {
            return null;
        }

        $category = strtolower(trim($category));
        $allowed = array_map('strtolower', (array) config('chatbot.triage.categories', []));

        return in_array($category, $allowed, true) ? $category : null;
    }

    /**
     * Keep the severity only when it is one the config allows.
     */
    private function severity(mixed $severity): ?string
    {
        if (!is_string($severity)) {
            return null;
        }

        $severity = strtolower(trim($severity));
        $allowed = array_map('strtolower', (array) config('chatbot.triage.severities', []));

        return in_array($severity, $allowed, true) ? $severity : null;
    }

    /**
     * Normalise the red-flag list to a short array of non-empty strings.
     *
     * @return array<int, string>
     */
    private function redFlags(mixed $redFlags): array
    {
        if (!is_array($redFlags)) {
            return [];
        }

        $clean = [];

        foreach ($redFlags as $flag) {
            if (!is_string($flag)) {
                continue;
            }

            $flag = trim($flag);

            // "none" is the kiosk's way of saying there are none.
            if ($flag === '' || strtolower($flag) === 'none') {
                continue;
            }

            $clean[] = $flag;
        }

        return array_values(array_unique($clean));
    }
}
