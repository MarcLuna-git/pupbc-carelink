<?php

namespace App\Services;

use App\Models\Medicine;
use App\Models\Notification;
use App\Models\User;

/**
 * Nurse notifications for medicines that expire today and medicines that have expired.
 * ("Expiring soon" is created beside the callers of this class: the notifications
 * endpoint and the medicines:notify-expiring command.)
 *
 * One notification per nurse, medicine and expiry date, so a medicine restocked with a
 * new date alerts again when that date comes. A medicine with no stock left is skipped:
 * there is nothing on the shelf to remove.
 */
class MedicineExpiryAlerts
{
    public const EXPIRES_TODAY = 'medicine_expires_today';
    public const EXPIRED = 'medicine_expired';

    /** Expiry notifications are kept when dismissed (marked, not deleted) so they are not created again. */
    public const KEPT_WHEN_DISMISSED = ['medicine_expiring_soon', self::EXPIRES_TODAY, self::EXPIRED];

    public static function generateFor(User $nurse): int
    {
        $today = today('Asia/Manila');
        $found = [];
        foreach ([self::EXPIRES_TODAY => Medicine::expiresToday(), self::EXPIRED => Medicine::expired()] as $type => $query) {
            foreach ($query->where('medicines.quantity', '>', 0)->get(['id', 'name', 'expiry_date', 'quantity']) as $medicine) {
                $expiry = $medicine->nearestExpiry();
                if (!$expiry) {
                    continue;
                }
                $expiryDay = $expiry->toDateString();
                // Checked again in clinic time, in case the server clock and the clinic's differ.
                $isToday = $expiryDay === $today->toDateString();
                if ($type === self::EXPIRES_TODAY ? !$isToday : $expiryDay >= $today->toDateString()) {
                    continue;
                }
                $found[] = [$type, $medicine, $expiry];
            }
        }
        if (!$found) {
            return 0;
        }

        // Read the nurse's existing alerts once, dismissed ones included.
        $key = fn (string $type, $medicineId, $expiryDay) => "$type|$medicineId|$expiryDay";
        $existing = Notification::where('user_id', $nurse->id)
            ->whereIn('type', [self::EXPIRES_TODAY, self::EXPIRED])
            ->get(['type', 'data'])
            ->mapWithKeys(fn ($notification) => [$key($notification->type, $notification->data['medicine_id'] ?? '', $notification->data['expiry_date'] ?? '') => true]);

        $created = 0;
        foreach ($found as [$type, $medicine, $expiry]) {
            if ($existing->has($key($type, $medicine->id, $expiry->toDateString()))) {
                continue;
            }
            Notification::create([
                'user_id' => $nurse->id,
                'type' => $type,
                'title' => $type === self::EXPIRED ? 'Medicine Expired' : 'Medicine Expires Today',
                'message' => $type === self::EXPIRED
                    ? $medicine->name . ' expired on ' . $expiry->format('M j, Y') . '. Remove it from use and record the stock as expired.'
                    : $medicine->name . ' expires today (' . $expiry->format('M j, Y') . ').',
                'data' => ['medicine_id' => $medicine->id, 'expiry_date' => $expiry->toDateString()],
            ]);
            $created++;
        }

        return $created;
    }
}
