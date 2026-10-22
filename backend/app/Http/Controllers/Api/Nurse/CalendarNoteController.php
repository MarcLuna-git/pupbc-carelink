<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use App\Models\CalendarNote;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class CalendarNoteController extends Controller
{
    /**
     * Notes between two dates (inclusive), e.g. the weeks shown in one month view.
     */
    public function index(Request $request)
    {
        $data = $request->validate([
            'from' => 'required|date_format:Y-m-d',
            'to' => 'required|date_format:Y-m-d|after_or_equal:from',
        ]);

        $notes = CalendarNote::with('author:id,first_name,last_name')
            ->whereBetween('note_date', [$data['from'], $data['to']])
            ->orderBy('note_date')
            ->orderBy('created_at')
            ->limit(500)
            ->get();

        return response()->json(['success' => true, 'data' => $notes])
            ->header('Cache-Control', 'private, no-store');
    }

    public function store(Request $request)
    {
        $note = CalendarNote::create($this->validated($request) + ['created_by' => Auth::id()]);

        return response()->json([
            'success' => true,
            'data' => $note->fresh()->load('author:id,first_name,last_name'),
            'message' => 'Note added.',
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $note = CalendarNote::findOrFail($id);
        $note->update($this->validated($request));

        return response()->json([
            'success' => true,
            'data' => $note->fresh()->load('author:id,first_name,last_name'),
            'message' => 'Note updated.',
        ]);
    }

    public function destroy($id)
    {
        CalendarNote::findOrFail($id)->delete();

        return response()->json(['success' => true, 'message' => 'Note deleted.']);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'note_date' => 'required|date_format:Y-m-d',
            'title' => 'required|string|max:120',
            'details' => 'nullable|string|max:2000',
            'color' => ['nullable', Rule::in(CalendarNote::COLORS)],
        ]);
        $data['title'] = trim($data['title']);
        $data['details'] = isset($data['details']) ? trim($data['details']) : null;
        $data['color'] = $data['color'] ?? 'maroon';

        return $data;
    }
}
