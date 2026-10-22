<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Student profile pictures, served through the API (/api/media/...) instead
 * of the public/storage symlink and APP_URL, which differ per host (local,
 * Render, shared hosting). Each file is kept on the public disk and copied
 * to the media_files table so it survives Render's ephemeral disk.
 */
class AvatarStore
{
    public const DIRECTORY = 'student-avatars';

    public static function store(UploadedFile $file): string
    {
        $path = $file->store(self::DIRECTORY, 'public');

        DB::table('media_files')->insert([
            'path' => $path,
            'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
            'contents' => base64_encode(file_get_contents($file->getRealPath())),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $path;
    }

    public static function delete(?string $path): void
    {
        if (!$path) {
            return;
        }

        Storage::disk('public')->delete($path);
        DB::table('media_files')->where('path', $path)->delete();
    }

    public static function url(string $path): string
    {
        return url('api/media/' . ltrim($path, '/'));
    }

    public static function response(string $path)
    {
        // File names are unique per upload, so the image never changes.
        $headers = ['Cache-Control' => 'public, max-age=31536000, immutable'];

        $disk = Storage::disk('public');
        if ($disk->exists($path)) {
            return $disk->response($path, null, $headers);
        }

        $file = DB::table('media_files')->where('path', $path)->first();
        abort_unless($file, 404);

        return response(base64_decode($file->contents), 200, $headers + ['Content-Type' => $file->mime_type]);
    }
}
