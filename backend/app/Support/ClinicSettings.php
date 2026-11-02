<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Clinic-wide options stored in clinic_settings. The queue's arrival time is the time a called
 * student has to arrive before they are skipped (SkippedQueueExpiry); the nurse sets it from
 * Consultation → Queue list → Options.
 */
class ClinicSettings
{
    public const DEFAULT_CALL_TIMEOUT_SECONDS = 60;
    public const MIN_CALL_TIMEOUT_SECONDS = 10;
    public const MAX_CALL_TIMEOUT_SECONDS = 900;

    private static ?int $callTimeoutMemo = null;

    public static function callTimeoutSeconds(): int
    {
        if (self::$callTimeoutMemo !== null) return self::$callTimeoutMemo;
        // Before the migration runs (e.g. a fresh deploy mid-boot), fall back to the default.
        $value = Schema::hasTable('clinic_settings')
            ? DB::table('clinic_settings')->where('key', 'call_timeout_seconds')->value('value')
            : null;
        $seconds = (int) ($value ?: self::DEFAULT_CALL_TIMEOUT_SECONDS);
        return self::$callTimeoutMemo = max(self::MIN_CALL_TIMEOUT_SECONDS, min(self::MAX_CALL_TIMEOUT_SECONDS, $seconds));
    }

    public static function setCallTimeoutSeconds(int $seconds, ?string $userId): void
    {
        $values = ['value' => (string) $seconds, 'updated_by' => $userId, 'updated_at' => now()];
        if (!DB::table('clinic_settings')->where('key', 'call_timeout_seconds')->update($values)) {
            DB::table('clinic_settings')->insert($values + ['key' => 'call_timeout_seconds', 'created_at' => now()]);
        }
        self::$callTimeoutMemo = $seconds;
        \App\Services\NurseSync::changed('queue');
    }
}
