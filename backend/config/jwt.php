<?php


return [


    'secret' => env('JWT_SECRET'),

    'keys' => [


        'public' => env('JWT_PUBLIC_KEY'),

        'private' => env('JWT_PRIVATE_KEY'),

        'passphrase' => env('JWT_PASSPHRASE'),

    ],

    'ttl' => env('JWT_TTL', 60),

    /*
    | The token is sent to the browser as an httpOnly cookie (App\Support\AuthCookie).
    | Secure (HTTPS only) by default; false only for a plain-http test host that is not localhost.
    */
    'cookie_secure' => env('AUTH_COOKIE_SECURE', true),

    'refresh_ttl' => env('JWT_REFRESH_TTL', 20160),

    'algo' => env('JWT_ALGO', 'HS256'),


    'required_claims' => [
        'iss',
        'iat',
        'exp',
        'nbf',
        'sub',
        'jti',
    ],


    'persistent_claims' => [
    ],

    'lock_subject' => true,

    'leeway' => env('JWT_LEEWAY', 0),

    'blacklist_enabled' => env('JWT_BLACKLIST_ENABLED', true),

    'blacklist_grace_period' => env('JWT_BLACKLIST_GRACE_PERIOD', 0),

    'decrypt_cookies' => false,

    'providers' => [


        'jwt' => Tymon\JWTAuth\Providers\JWT\Lcobucci::class,

        'auth' => Tymon\JWTAuth\Providers\Auth\Illuminate::class,

        'storage' => Tymon\JWTAuth\Providers\Storage\Illuminate::class,

    ],

];
