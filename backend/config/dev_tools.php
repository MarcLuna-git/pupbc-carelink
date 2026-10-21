<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Developer Tools
    |--------------------------------------------------------------------------
    |
    | Developer Tools in the Student portal (Settings), Nurse portal (Settings)
    | and the hidden /kiosk/settings page. Each "Remove time Guard" only lifts
    | its own portal's time rules — see App\Support\TimeGuard. Turning one on,
    | and Student "Reset data", ask for the password below.
    |
    | Set DEV_TOOLS_ENABLED=false to switch the feature off entirely.
    |
    */

    'enabled' => (bool) env('DEV_TOOLS_ENABLED', true),

    'password' => env('DEV_TOOLS_PASSWORD', 'admin'),
];
