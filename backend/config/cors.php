<?php

return [

    'paths' => [
        'api/*',
        'sanctum/csrf-cookie',
        'kiosk/*',
    ],

    'allowed_methods' => [
        'GET',
        'HEAD',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
    ],

    'allowed_origins' => [
        env('APP_URL', 'http://127.0.0.1:8000'),

        'http://localhost:5173',
        'http://127.0.0.1:5173',

        env('FRONTEND_URL', 'http://localhost:5173'),

        'https://pupbc-carelink-testing.vercel.app',

        'https://pup-carelink-testing-frontend.onrender.com',
        'https://pup-carelink-testing-backend.onrender.com',
        'https://carelink-frontend.onrender.com',
        'https://carelink-backend.onrender.com',
    ],

    'allowed_origins_patterns' => [

        // 192.168.0.0/16
        '#^http://192\.168\.\d{1,3}\.\d{1,3}:5173$#i',

        // 10.0.0.0/8
        '#^http://10\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173$#i',

        // 172.16.0.0 - 172.31.255.255
        '#^http://172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}:5173$#i',

        // Para sa frontend na gumagamit pa ng port 3000.
        '#^http://192\.168\.\d{1,3}\.\d{1,3}:3000$#i',
        '#^http://10\.\d{1,3}\.\d{1,3}\.\d{1,3}:3000$#i',
        '#^http://172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}:3000$#i',

    ],

    'allowed_headers' => [
        'Authorization',
        'Content-Type',
        'Accept',
        'Origin',
        'X-Requested-With',
        'X-CSRF-TOKEN',
        'X-Socket-Id',
        'X-Kiosk-Token',
    ],

    'exposed_headers' => [
        'Authorization',
        'Content-Disposition',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'Retry-After',
    ],

    'max_age' => 86400,

    'supports_credentials' => true,
];
