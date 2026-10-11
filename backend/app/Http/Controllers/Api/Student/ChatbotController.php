<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Services\Chatbot\ClinicAssistant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ChatbotController extends Controller
{
    private ClinicAssistant $assistant;

    public function __construct(ClinicAssistant $assistant)
    {
        $this->assistant = $assistant;
    }

    public function message(Request $request): JsonResponse
    {
        if (!config('chatbot.enabled')) {
            return response()->json([
                'success' => false,
                'message' => 'The clinic assistant is currently disabled.',
            ], 503);
        }

        $maxLength = (int) config('chatbot.max_message_length', 1000);
        $maxHistory = (int) config('chatbot.max_history', 10);

        $validated = $request->validate([
            'message' => 'required|string|max:' . $maxLength,
            'history' => 'nullable|array|max:' . $maxHistory,
            'history.*.role' => 'nullable|string|in:user,assistant',
            'history.*.text' => 'nullable|string|max:' . $maxLength,
        ]);

        $result = $this->assistant->reply(
            $validated['message'],
            $validated['history'] ?? []
        );

        if (!$result['ok']) {
            // Log the provider error for operators, but never surface it to the student.
            Log::warning('Chatbot reply failed', [
                'user_id' => auth()->id(),
                'error' => $result['error'],
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'reply' => $result['reply'],
                'degraded' => !$result['ok'],
                'suggestions' => $result['suggestions'] ?? [],
            ],
        ]);
    }
}
