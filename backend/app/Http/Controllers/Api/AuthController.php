<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    protected AuthService $authService;

    private const ALLOWED_COURSES = [
        'BSIT',
        'BSCPE',
        'BSIE',
        'BSBA-HRM',
        'BSED-SS',
        'BSED-English',
        'BEED',
        'BSPSYCH',
        'DIT',
        'DCET',
    ];

    private const ALLOWED_YEARS = [
        '1st Year',
        '2nd Year',
        '3rd Year',
        '4th Year',
    ];

    private const SECTIONS_BY_YEAR = [
        '1st Year' => [
            '1-1',
            '1-2',
            '1-3',
            '1-4',
            '1-5',
        ],

        '2nd Year' => [
            '2-1',
            '2-2',
            '2-3',
            '2-4',
            '2-5',
        ],

        '3rd Year' => [
            '3-1',
            '3-2',
            '3-3',
            '3-4',
            '3-5',
        ],

        '4th Year' => [
            '4-1',
            '4-2',
            '4-3',
            '4-4',
            '4-5',
        ],
    ];

    public function __construct(
        AuthService $authService
    ) {
        $this->authService = $authService;
    }

    public function register(Request $request): JsonResponse
    {
        try {
            $this->normalizeRegistrationInput($request);

            $selectedYear = $request->input('year');

            $allowedSections =
                self::SECTIONS_BY_YEAR[$selectedYear] ?? [];

            $data = $request->validate(
                [
                    'student_id' => [
                        'required',
                        'string',
                        'max:17',
                        'regex:/^\d{4}-\d{5}-BN-[01]$/',
                    ],

                    'first_name' => [
                        'required',
                        'string',
                        'max:100',
                        'regex:/^[\pL\s\-\'.]+$/u',
                    ],

                    'middle_name' => [
                        'nullable',
                        'string',
                        'max:100',
                        'regex:/^[\pL\s\-\'.]+$/u',
                    ],

                    'last_name' => [
                        'required',
                        'string',
                        'max:100',
                        'regex:/^[\pL\s\-\'.]+$/u',
                    ],

                    'email' => [
                        'required',
                        'email',
                        'max:255',
                    ],

                    'password' => [
                        'required',
                        'string',
                        'min:8',
                        'confirmed',
                    ],

                    'birthday' => [
                        'required',
                        'date_format:Y-m-d',
                        'before_or_equal:today',
                    ],

                    'gender' => [
                        'required',
                        'string',
                        Rule::in([
                            'male',
                            'female',
                            'other',
                        ]),
                    ],

                    'course' => [
                        'required',
                        'string',
                        'max:100',
                        Rule::in(
                            self::ALLOWED_COURSES
                        ),
                    ],

                    'year' => [
                        'required',
                        'string',
                        'max:10',
                        Rule::in(
                            self::ALLOWED_YEARS
                        ),
                    ],

                    'section' => [
                        'required',
                        'string',
                        'max:10',
                        Rule::in(
                            $allowedSections
                        ),
                    ],

                    'mobile_number' => [
                        'required',
                        'string',
                        'max:13',
                        'regex:/^\+639\d{9}$/',
                    ],
                ],
                [
                    'student_id.required' =>
                        'Student ID is required.',

                    'student_id.regex' =>
                        'Student ID must follow the format 2023-00000-BN-0.',

                    'student_id.max' =>
                        'Student ID format is invalid.',

                    'first_name.required' =>
                        'First name is required.',

                    'first_name.regex' =>
                        'First name may contain letters, spaces, apostrophes, periods, and hyphens only.',

                    'middle_name.regex' =>
                        'Middle name may contain letters, spaces, apostrophes, periods, and hyphens only.',

                    'last_name.required' =>
                        'Last name is required.',

                    'last_name.regex' =>
                        'Last name may contain letters, spaces, apostrophes, periods, and hyphens only.',

                    'email.required' =>
                        'Email address is required.',

                    'email.email' =>
                        'Please enter a valid email address.',

                    'password.required' =>
                        'Password is required.',

                    'password.min' =>
                        'Password must be at least 8 characters.',

                    'password.confirmed' =>
                        'Password confirmation does not match.',

                    'birthday.required' =>
                        'Birthday is required.',

                    'birthday.date_format' =>
                        'Birthday format is invalid.',

                    'birthday.before_or_equal' =>
                        'Birthday cannot be in the future.',

                    'gender.required' =>
                        'Gender is required.',

                    'gender.in' =>
                        'Please select a valid gender.',

                    'course.required' =>
                        'Course is required.',

                    'course.in' =>
                        'Please select a valid course.',

                    'year.required' =>
                        'Year level is required.',

                    'year.in' =>
                        'Please select a valid year level.',

                    'section.required' =>
                        'Section is required.',

                    'section.in' =>
                        'Please select a valid section for your year level.',

                    'mobile_number.required' =>
                        'Mobile number is required.',

                    'mobile_number.regex' =>
                        'Mobile number must use 09XXXXXXXXX or +639XXXXXXXXX format.',
                ]
            );

            $result = $this->authService
                ->requestRegistrationOtp($data);

            return response()->json([
                'success' => true,
                'message' => $result['message'],
            ], 200);

        } catch (\App\Exceptions\RegistrationDeliveryException $e) {
            return response()->json([
                'success' => false,
                'registration_pending' => true,
                'message' => $e->getMessage(),
            ], 503);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);

        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    public function verifyRegistration(
        Request $request
    ): JsonResponse {
        try {
            $this->normalizeEmailInput($request);

            $data = $request->validate(
                [
                    'email' => [
                        'required',
                        'email',
                        'max:255',
                    ],

                    'otp' => [
                        'required',
                        'string',
                        'size:6',
                        'regex:/^\d{6}$/',
                    ],
                ],
                [
                    'email.required' =>
                        'Email address is required.',

                    'email.email' =>
                        'Please enter a valid email address.',

                    'otp.required' =>
                        'Verification code is required.',

                    'otp.size' =>
                        'Verification code must contain 6 digits.',

                    'otp.regex' =>
                        'Verification code must contain numbers only.',
                ]
            );

            $result = $this->authService
                ->verifyRegistration(
                    $data['email'],
                    $data['otp']
                );

            return response()->json([
                'success' => true,
                'message' => $result['message'],
                'user' => $result['user'],
            ], 200);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);

        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    public function resendRegistrationOtp(
        Request $request
    ): JsonResponse {
        try {
            $this->normalizeEmailInput($request);

            $data = $request->validate(
                [
                    'email' => [
                        'required',
                        'email',
                        'max:255',
                    ],
                ],
                [
                    'email.required' =>
                        'Email address is required.',

                    'email.email' =>
                        'Please enter a valid email address.',
                ]
            );

            $result = $this->authService
                ->resendRegistrationOtp(
                    $data['email']
                );

            return response()->json([
                'success' => true,
                'message' => $result['message'],
            ], 200);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);

        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    
public function login(Request $request): JsonResponse
{
    $studentId = strtoupper(
        trim((string) $request->input('student_id', ''))
    );

    $request->merge([
        'student_id' => $studentId,
    ]);

    // Separate limits for each Student ID + IP address.
    $identity = hash(
        'sha256',
        $studentId . '|' . $request->ip()
    );

    $attemptKey = 'student-login:attempts:' . $identity;
    $lockKey = 'student-login:lock:' . $identity;

    $limiter = app(\Illuminate\Cache\RateLimiter::class);

    // Block requests while the 60-second lock is active.
    if ($limiter->tooManyAttempts($lockKey, 1)) {
        $seconds = max(1, $limiter->availableIn($lockKey));

        return response()->json([
            'success' => false,
            'locked' => true,
            'message' => 'Too many incorrect login attempts. Please try again in ' .
                $seconds . ' seconds.',
            'retry_after' => $seconds,
            'attempts_remaining' => 0,
        ], 429)->header('Retry-After', (string) $seconds);
    }

    try {
        $data = $request->validate([
            'student_id' => [
                'required',
                'string',
                'max:17',
                'regex:/^\d{4}-\d{5}-BN-[01]$/',
            ],
            'birthday' => [
                'required',
                'date_format:Y-m-d',
                'before_or_equal:today',
            ],
            'password' => [
                'required',
                'string',
            ],
        ]);

        // Keep the existing authentication service.
        $result = $this->authService->login($data);

        // Correct login resets previous failed attempts.
        $limiter->clear($attemptKey);

        return response()->json([
            'success' => true,
            'message' => 'Login successful.',
            'user' => $result['user'],
            'token' => $result['token'],
            'token_type' => $result['token_type'],
            'expires_in' => $result['expires_in'],
            'role' => $result['role'],
        ], 200);

    } catch (ValidationException $e) {
        // Missing or malformed form fields are validation errors,
        // not incorrect-credential attempts.
        return response()->json([
            'success' => false,
            'message' => 'Validation failed.',
            'errors' => $e->errors(),
        ], 422);

    } catch (\Throwable $e) {
        $credentialErrors = [
            'Invalid credentials.',
            'Invalid birthday.',
            'Invalid password.',
        ];

        // Do not count database or server errors as wrong passwords.
        if (!in_array($e->getMessage(), $credentialErrors, true)) {
            \Illuminate\Support\Facades\Log::error(
                'Student login failed unexpectedly.',
                ['exception' => $e]
            );

            return response()->json([
                'success' => false,
                'message' => 'Unable to sign in right now. Please try again.',
            ], 500);
        }

        // Count incorrect credentials within a five-minute window.
        $limiter->hit($attemptKey, 300);
        $attempts = $limiter->attempts($attemptKey);

        // The fifth incorrect attempt starts a fresh 60-second lock.
        if ($attempts >= 5) {
            $limiter->hit($lockKey, 60);
            $limiter->clear($attemptKey);

            return response()->json([
                'success' => false,
                'locked' => true,
                'message' => 'Too many incorrect login attempts. Please try again in 60 seconds.',
                'retry_after' => 60,
                'attempts_remaining' => 0,
            ], 429)->header('Retry-After', '60');
        }

        return response()->json([
            'success' => false,
            'message' => 'Student ID, birthday, or password is incorrect.',
            'attempts_remaining' => max(0, 5 - $attempts),
        ], 401);
    }
}

    public function nurseLogin(
        Request $request
    ): JsonResponse {
        try {
            $this->normalizeEmailInput($request);

            $data = $request->validate(
                [
                    'email' => [
                        'required',
                        'email',
                        'max:255',
                    ],

                    'password' => [
                        'required',
                        'string',
                    ],
                ],
                [
                    'email.required' =>
                        'Email address is required.',

                    'email.email' =>
                        'Please enter a valid email address.',

                    'password.required' =>
                        'Password is required.',
                ]
            );

            $result = $this->authService
                ->nurseLogin(
                    $data['email'],
                    $data['password']
                );

            return response()->json([
                'success' => true,
                'message' => 'Login successful.',
                'user' => $result['user'],
                'token' => $result['token'],
                'token_type' => $result['token_type'],
                'expires_in' => $result['expires_in'],
                'role' => $result['role'],
            ], 200);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);

        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 401);
        }
    }

    public function forgotPassword(
        Request $request
    ): JsonResponse {
        try {
            $this->normalizeEmailInput($request);

            $data = $request->validate(
                [
                    'email' => [
                        'required',
                        'email',
                        'max:255',
                    ],
                ],
                [
                    'email.required' =>
                        'Email address is required.',

                    'email.email' =>
                        'Please enter a valid email address.',
                ]
            );

            $result = $this->authService
                ->forgotPassword($data);

            return response()->json([
                'success' => true,
                'message' => $result['message'],
            ], 200);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);

        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    public function resetPassword(
        Request $request
    ): JsonResponse {
        try {
            $this->normalizeEmailInput($request);

            $data = $request->validate(
                [
                    'email' => [
                        'required',
                        'email',
                        'max:255',
                    ],

                    'otp' => [
                        'required',
                        'string',
                        'size:6',
                        'regex:/^\d{6}$/',
                    ],

                    'password' => [
                        'required',
                        'string',
                        'min:8',
                        'confirmed',
                    ],
                ],
                [
                    'email.required' =>
                        'Email address is required.',

                    'email.email' =>
                        'Please enter a valid email address.',

                    'otp.required' =>
                        'Verification code is required.',

                    'otp.size' =>
                        'Verification code must contain 6 digits.',

                    'otp.regex' =>
                        'Verification code must contain numbers only.',

                    'password.required' =>
                        'Password is required.',

                    'password.min' =>
                        'Password must be at least 8 characters.',

                    'password.confirmed' =>
                        'Password confirmation does not match.',
                ]
            );

            $result = $this->authService
                ->resetPassword($data);

            return response()->json([
                'success' => true,
                'message' => $result['message'],
            ], 200);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);

        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    public function changePassword(
        Request $request
    ): JsonResponse {
        try {
            $data = $request->validate(
                [
                    'current_password' => [
                        'required',
                        'string',
                    ],

                    'new_password' => [
                        'required',
                        'string',
                        'min:8',
                        'confirmed',
                    ],
                ],
                [
                    'current_password.required' =>
                        'Current password is required.',

                    'new_password.required' =>
                        'New password is required.',

                    'new_password.min' =>
                        'New password must be at least 8 characters.',

                    'new_password.confirmed' =>
                        'New password confirmation does not match.',
                ]
            );

            $result = $this->authService
                ->changePassword($data);

            return response()->json([
                'success' => true,
                'message' => $result['message'],
            ], 200);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);

        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    public function logout(): JsonResponse
    {
        try {
            $this->authService->logout();

            return response()->json([
                'success' => true,
                'message' => 'Logged out successfully.',
            ], 200);

        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Unable to logout.',
            ], 400);
        }
    }

    public function refresh(): JsonResponse
    {
        try {
            $result = $this->authService
                ->refreshToken();

            return response()->json([
                'success' => true,
                'token' => $result['token'],
                'token_type' => $result['token_type'],
                'expires_in' => $result['expires_in'],
            ], 200);

        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Unable to refresh token.',
            ], 401);
        }
    }

    public function me(): JsonResponse
    {
        try {
            $user = $this->authService
                ->getAuthenticatedUser();

            return response()->json([
                'success' => true,
                'user' => $user,
            ], 200);

        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }
    }

    private function normalizeRegistrationInput(
        Request $request
    ): void {
        $mobileNumber = preg_replace(
            '/\s+/',
            '',
            trim(
                (string) $request->input(
                    'mobile_number',
                    ''
                )
            )
        );

        if (
            preg_match(
                '/^09\d{9}$/',
                $mobileNumber
            )
        ) {
            $mobileNumber =
                '+63' .
                substr(
                    $mobileNumber,
                    1
                );
        } elseif (
            preg_match(
                '/^639\d{9}$/',
                $mobileNumber
            )
        ) {
            $mobileNumber =
                '+' .
                $mobileNumber;
        }

        $middleName = trim(
            (string) $request->input(
                'middle_name',
                ''
            )
        );

        $request->merge([
            'student_id' => strtoupper(
                trim(
                    (string) $request->input(
                        'student_id',
                        ''
                    )
                )
            ),

            'first_name' => trim(
                (string) $request->input(
                    'first_name',
                    ''
                )
            ),

            'middle_name' =>
                $middleName === ''
                    ? null
                    : $middleName,

            'last_name' => trim(
                (string) $request->input(
                    'last_name',
                    ''
                )
            ),

            'email' => strtolower(
                trim(
                    (string) $request->input(
                        'email',
                        ''
                    )
                )
            ),

            'mobile_number' =>
                $mobileNumber,

            'course' => trim(
                (string) $request->input(
                    'course',
                    ''
                )
            ),

            'year' => trim(
                (string) $request->input(
                    'year',
                    ''
                )
            ),

            'section' => trim(
                (string) $request->input(
                    'section',
                    ''
                )
            ),

            'gender' => strtolower(
                trim(
                    (string) $request->input(
                        'gender',
                        ''
                    )
                )
            ),
        ]);
    }

    private function normalizeEmailInput(
        Request $request
    ): void {
        $request->merge([
            'email' => strtolower(
                trim(
                    (string) $request->input(
                        'email',
                        ''
                    )
                )
            ),
        ]);
    }
}
