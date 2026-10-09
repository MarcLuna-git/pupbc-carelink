<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Check-in Window Configuration
    |--------------------------------------------------------------------------
    |
    | These values define the check-in window for appointments.
    | All times are in minutes relative to the appointment time_slot.
    |
    */

    // Minutes before appointment when check-in opens (default: 15)
    'checkin_early_minutes' => env('CHECKIN_EARLY_MINUTES', 15),

    // Minutes after appointment when check-in deadline passes (default: 30)
    'checkin_late_minutes' => env('CHECKIN_LATE_MINUTES', 30),

];
