<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\Cache;

/**
 * "Remove time Guard" switches from each portal's Developer Tools. Each portal
 * keeps its own rules:
 *   - Student (per account): booking past dates/time slots and Sundays.
 *   - Nurse (clinic-wide): automatic skip after the arrival time, skipped → no-show, Recall
 *     of a skipped visit after the deadline, past reschedule/follow-up/medicine expiry dates.
 *   - Kiosk (kiosk-wide): the check-in window (open all day).
 */
class TimeGuard
{
    private const KEY = 'dev_tools.time_guard_bypass.';

    /*
     * Safety: every switch is OFF by default and never stays on by accident. It turns itself
     * off after MAX_ON_HOURS, when the user signs in or out (resetFor), and the portals turn it
     * off when the browser is opened again after being closed (services/devTools.js).
     */
    public const MAX_ON_HOURS = 8;

    /** Sign-in / sign-out: a student's own switch, or the clinic-wide nurse switch. */
    public static function resetFor(?User $user): void
    {
        if (!$user) return;
        if ($user->role === 'nurse') self::setNursePortal(false);
        elseif ($user->role === 'student') self::set($user, false);
    }

    /** @var array<string, bool> Per-request memo, so loops do not re-read the cache. */
    private static array $memo = [];

    /**
     * Whether the time guards are bypassed for a student. Accepts a User, a
     * user id, or nothing (the authenticated user).
     */
    public static function bypassed(User|string|int|null $user = null): bool
    {
        if (!config('dev_tools.enabled')) {
            return false;
        }

        $id = $user instanceof User ? $user->id : ($user ?? auth()->id());

        if ($id === null) {
            return false;
        }

        return self::$memo[(string) $id] ??= (bool) Cache::get(self::KEY . $id, false);
    }

    public static function set(User|string|int $user, bool $bypassed): void
    {
        $id = (string) ($user instanceof User ? $user->id : $user);

        if ($bypassed) {
            Cache::put(self::KEY . $id, true, now()->addHours(self::MAX_ON_HOURS));
        } else {
            Cache::forget(self::KEY . $id);
        }

        self::$memo[$id] = $bypassed;
    }

    /*
     * Nurse portal switch (Nurse → Settings → Developer Tools). It is
     * clinic-wide rather than per nurse because the queue is shared and its
     * skipped → no-show reconciliation also runs from the scheduler.
     */
    private const NURSE_PORTAL_KEY = 'dev_tools.nurse_portal_time_guard_bypass';

    private static ?bool $nursePortalMemo = null;

    public static function nursePortalBypassed(): bool
    {
        if (!config('dev_tools.enabled')) {
            return false;
        }

        return self::$nursePortalMemo ??= (bool) Cache::get(self::NURSE_PORTAL_KEY, false);
    }

    public static function setNursePortal(bool $bypassed): void
    {
        if ($bypassed) {
            Cache::put(self::NURSE_PORTAL_KEY, true, now()->addHours(self::MAX_ON_HOURS));
        } else {
            Cache::forget(self::NURSE_PORTAL_KEY);
        }

        self::$nursePortalMemo = $bypassed;
    }

    /*
     * Kiosk switch (hidden /kiosk/settings page). The kiosk has no signed-in
     * user, so it is kiosk-wide: while on, check-in is open for the whole
     * appointment day for every student with an approved visit today.
     */
    private const KIOSK_KEY = 'dev_tools.kiosk_time_guard_bypass';

    private static ?bool $kioskMemo = null;

    public static function kioskBypassed(): bool
    {
        if (!config('dev_tools.enabled')) {
            return false;
        }

        return self::$kioskMemo ??= (bool) Cache::get(self::KIOSK_KEY, false);
    }

    public static function setKiosk(bool $bypassed): void
    {
        if ($bypassed) {
            Cache::put(self::KIOSK_KEY, true, now()->addHours(self::MAX_ON_HOURS));
        } else {
            Cache::forget(self::KIOSK_KEY);
        }

        self::$kioskMemo = $bypassed;
    }
}
