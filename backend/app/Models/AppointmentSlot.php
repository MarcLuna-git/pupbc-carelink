<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AppointmentSlot extends Model
{
    use HasFactory;

    private const TIMEZONE = 'Asia/Manila';

    private const MAX_SLOTS = 10;

    private const TIME_SLOTS = [
        '8:00 AM',
        '8:30 AM',
        '9:00 AM',
        '9:30 AM',
        '10:00 AM',
        '10:30 AM',
        '11:00 AM',
        '11:30 AM',
        '1:00 PM',
        '1:30 PM',
        '2:00 PM',
        '2:30 PM',
        '3:00 PM',
        '3:30 PM',
        '4:00 PM',
        '4:30 PM',
    ];

    protected $fillable = [
        'date',
        'time_slot',
        'max_slots',
        'booked_count',
    ];

    protected $casts = [
        'date' => 'date:Y-m-d',
    ];

    public static function getAvailableSlots($date): array
    {
        $date = self::normalizeDate($date);

        if (self::isSunday($date)) {
            return [];
        }

        $slots = [];

        foreach (self::TIME_SLOTS as $time) {
            $bookedCount = self::bookingQuery(
                $date,
                $time
            )->count();

            $isPast = self::isPastSlot(
                $date,
                $time
            );

            $isFull =
                $isPast ||
                $bookedCount >= self::MAX_SLOTS;

            $slots[] = [
                'time' => $time,

                'max' =>
                    self::MAX_SLOTS,

                'booked' =>
                    $bookedCount,

                'available' =>
                    $isPast
                        ? 0
                        : max(
                            0,
                            self::MAX_SLOTS -
                            $bookedCount
                        ),

                /*
                 * Keep both formats temporarily
                 * because older and newer frontend
                 * code use different property names.
                 */
                'is_full' =>
                    $isFull,

                'isFull' =>
                    $isFull,
            ];
        }

        return $slots;
    }

    public static function isSlotAvailable(
        $date,
        $timeSlot,
        ?string $excludeAppointmentId = null
    ): bool {
        $date = self::normalizeDate($date);

        if (
            self::isSunday($date) ||
            !in_array(
                $timeSlot,
                self::TIME_SLOTS,
                true
            ) ||
            self::isPastSlot(
                $date,
                $timeSlot
            )
        ) {
            return false;
        }

        $query = self::bookingQuery(
            $date,
            $timeSlot
        );

        if ($excludeAppointmentId) {
            $query->where(
                'id',
                '!=',
                $excludeAppointmentId
            );
        }

        return $query->count() <
            self::MAX_SLOTS;
    }

    public static function remainingSlots(
        $date,
        $timeSlot,
        ?string $excludeAppointmentId = null
    ): int {
        $date = self::normalizeDate($date);

        if (
            self::isSunday($date) ||
            !in_array(
                $timeSlot,
                self::TIME_SLOTS,
                true
            ) ||
            self::isPastSlot(
                $date,
                $timeSlot
            )
        ) {
            return 0;
        }

        $query = self::bookingQuery(
            $date,
            $timeSlot
        );

        if ($excludeAppointmentId) {
            $query->where(
                'id',
                '!=',
                $excludeAppointmentId
            );
        }

        $bookedCount =
            $query->count();

        return max(
            0,
            self::MAX_SLOTS -
            $bookedCount
        );
    }

    public static function isSunday(
        $date
    ): bool {
        $date = self::normalizeDate(
            $date
        );

        return Carbon::createFromFormat(
            'Y-m-d',
            $date,
            self::TIMEZONE
        )->isSunday();
    }

    private static function isPastSlot(
        $date,
        $timeSlot
    ): bool {
        $date = self::normalizeDate(
            $date
        );

        $slot =
            Carbon::createFromFormat(
                'Y-m-d g:i A',
                $date .
                ' ' .
                $timeSlot,
                self::TIMEZONE
            );

        return $slot->lessThanOrEqualTo(
            Carbon::now(
                self::TIMEZONE
            )
        );
    }

    private static function bookingQuery(
        string $date,
        string $timeSlot
    ) {
        return Appointment::whereDate(
            'appointment_date',
            $date
        )
            ->where(
                'time_slot',
                $timeSlot
            )
            ->whereIn(
                'status',
                [
                    'pending',
                    'approved',
                ]
            );
    }

    private static function normalizeDate(
        $date
    ): string {
        if (
            $date instanceof
            \DateTimeInterface
        ) {
            return Carbon::instance(
                $date
            )
                ->setTimezone(
                    self::TIMEZONE
                )
                ->format(
                    'Y-m-d'
                );
        }

        return Carbon::parse(
            $date,
            self::TIMEZONE
        )->format(
            'Y-m-d'
        );
    }
}