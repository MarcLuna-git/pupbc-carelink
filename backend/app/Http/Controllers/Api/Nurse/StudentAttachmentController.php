<?php

namespace App\Http\Controllers\Api\Nurse;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\StudentAttachment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Extra record files for a student (x-ray photos, lab results, documents),
 * uploaded and viewed by nurses only. Files live on the private local disk,
 * with a database copy that survives Render's ephemeral disk.
 */
class StudentAttachmentController extends Controller
{
    private const DISK = 'local';
    private const MAX_KB = 10240;
    // Every file is also stored as base64 in the database, so a photo is kept small. The nurse
    // screen shrinks photos to fit before uploading; this is the limit the server enforces.
    private const IMAGE_MAX_KB = 200;
    private const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    private const MIMES = 'jpg,jpeg,png,webp,gif,pdf,doc,docx,xls,xlsx,txt';
    // Shown in the browser; anything else is downloaded so it never runs as a page.
    private const INLINE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

    public function index($id)
    {
        $student = User::withTrashed()->where('role', 'student')->findOrFail($id);

        $files = StudentAttachment::with('uploader:id,first_name,last_name')
            ->where('user_id', $student->id)
            ->latest()
            ->get();

        return response()->json(['success' => true, 'data' => $files])
            ->header('Cache-Control', 'private, no-store');
    }

    public function store(Request $request, $id)
    {
        $student = User::where('role', 'student')->findOrFail($id);
        $data = $request->validate([
            'file' => 'required|file|max:' . self::MAX_KB . '|mimes:' . self::MIMES,
            'category' => ['required', Rule::in(StudentAttachment::CATEGORIES)],
            'description' => 'nullable|string|max:255',
        ]);

        $file = $data['file'];
        if (in_array($file->getMimeType(), self::IMAGE_TYPES, true) && $file->getSize() > self::IMAGE_MAX_KB * 1024) {
            throw ValidationException::withMessages([
                'file' => 'Photos must be ' . self::IMAGE_MAX_KB . ' KB or smaller. Reduce the photo and try again.',
            ]);
        }
        $path = $file->store('student-attachments/' . $student->id, self::DISK);

        $attachment = StudentAttachment::create([
            'user_id' => $student->id,
            'uploaded_by' => Auth::id(),
            'category' => $data['category'],
            'description' => isset($data['description']) ? trim($data['description']) ?: null : null,
            'original_name' => mb_substr($file->getClientOriginalName(), 0, 255),
            'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
            'size' => $file->getSize(),
            'path' => $path,
            'contents' => base64_encode(file_get_contents($file->getRealPath())),
        ]);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'student_attachment_uploaded',
            'description' => "Attached {$attachment->category} file {$attachment->id} to student {$student->id}",
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'data' => $attachment->fresh()->load('uploader:id,first_name,last_name'),
            'message' => 'File attached.',
        ], 201);
    }

    public function file($id, $attachmentId)
    {
        $attachment = StudentAttachment::where('user_id', $id)->findOrFail($attachmentId);
        $inline = in_array($attachment->mime_type, self::INLINE_TYPES, true);
        $name = str_replace(['"', '\\', "\r", "\n"], '', $attachment->original_name);

        $disk = Storage::disk(self::DISK);
        $contents = $disk->exists($attachment->path)
            ? $disk->get($attachment->path)
            : base64_decode($attachment->contents);

        return response($contents, 200, [
            'Content-Type' => $inline ? $attachment->mime_type : 'application/octet-stream',
            'Content-Disposition' => ($inline ? 'inline' : 'attachment') . '; filename="' . $name . '"',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function destroy(Request $request, $id, $attachmentId)
    {
        $attachment = StudentAttachment::where('user_id', $id)->findOrFail($attachmentId);
        Storage::disk(self::DISK)->delete($attachment->path);
        $attachment->delete();

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'student_attachment_deleted',
            'description' => "Deleted {$attachment->category} file {$attachment->id} ({$attachment->original_name}) of student {$id}",
            'ip_address' => $request->ip(),
        ]);

        return response()->json(['success' => true, 'message' => 'File deleted.']);
    }
}
