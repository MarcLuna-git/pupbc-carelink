<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\BatchDocument;
use App\Models\User;
use App\Support\DatabaseSearch;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/* Nurse portal → Consultation → Batch Release: documents issued for a group of students (types in config/batch_documents.php). */
class BatchDocumentController extends Controller
{
    public function index(Request $request)
    {
        $query = BatchDocument::with('issuer:id,first_name,last_name');
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }
        if ($request->filled('q')) {
            $query->where('title', DatabaseSearch::like($query), "%{$request->q}%");
        }

        $documents = $query->orderByDesc('issued_date')->orderByDesc('created_at')->limit(200)->get();

        return response()->json(['success' => true, 'data' => $documents]);
    }

    public function store(Request $request)
    {
        $types = config('batch_documents');
        $request->validate(['type' => ['required', 'string', Rule::in(array_keys($types))]], ['type.in' => 'Choose a document.']);
        $type = $types[$request->type];

        $rules = collect($type['rules'])->mapWithKeys(fn ($rule, $field) => ["fields.$field" => $rule])->all();
        $messages = collect($type['messages'] ?? [])->mapWithKeys(fn ($text, $key) => ["fields.$key" => $text])->all();
        $data = $request->validate($rules + [
            'students' => 'required|array|min:1|max:300',
            'students.*.name' => 'required|string|max:191',
            'students.*.student_id' => 'nullable|uuid',
        ], $messages + [
            'students.required' => 'Add at least one student.',
            'students.min' => 'Add at least one student.',
        ]);

        // Only the fields this document defines are kept, with text trimmed.
        $fields = collect(array_keys($type['rules']))->mapWithKeys(function ($field) use ($data) {
            $value = $data['fields'][$field] ?? null;
            return [$field => is_string($value) ? (trim($value) === '' ? null : trim($value)) : $value];
        })->all();

        // Tidy the names: trimmed, no blanks, no repeats (case-insensitive), A to Z. A link is kept only to a real student.
        $linked = User::where('role', 'student')
            ->whereIn('id', collect($data['students'])->pluck('student_id')->filter()->all())
            ->pluck('id')->all();
        $students = collect($data['students'])
            ->map(fn ($student) => [
                'name' => trim(preg_replace('/\s+/', ' ', $student['name'])),
                'student_id' => in_array($student['student_id'] ?? null, $linked, true) ? $student['student_id'] : null,
            ])
            ->filter(fn ($student) => $student['name'] !== '')
            ->unique(fn ($student) => mb_strtolower($student['name']))
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)->values()->all();
        abort_if(!$students, 422, 'Add at least one student.');

        $document = BatchDocument::create([
            'type' => $request->type,
            'title' => $fields[$type['title_field']] ?? $type['label'],
            'fields' => $fields,
            'students' => $students,
            'issued_date' => $fields[$type['date_field']] ?? today('Asia/Manila')->toDateString(),
            'issued_by' => auth()->id(),
        ]);
        AuditLog::create([
            'user_id' => auth()->id(), 'action' => 'batch_document_created',
            'description' => "{$type['label']} issued for {$document->title} ({$document->id}), " . count($students) . ' students',
            'ip_address' => request()->ip(),
        ]);

        return response()->json(['success' => true, 'data' => $document->load('issuer:id,first_name,last_name'), 'message' => "{$type['label']} saved"], 201);
    }

    public function destroy($id)
    {
        $document = BatchDocument::findOrFail($id);
        $label = config("batch_documents.{$document->type}.label", 'Batch document');
        $document->delete();
        AuditLog::create([
            'user_id' => auth()->id(), 'action' => 'batch_document_deleted',
            'description' => "{$label} deleted for {$document->title} ({$document->id})",
            'ip_address' => request()->ip(),
        ]);

        return response()->json(['success' => true, 'message' => "{$label} deleted"]);
    }
}
