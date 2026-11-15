<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuthService;
use App\Support\AuthCookie;
use App\Support\RegistrationAcademics;
use App\Support\TimeGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;


class AuthController extends Controller
{
    protected AuthService $authService;

    public function __construct(
        AuthService $authService
    ) {
        $this->authService = $authService;
    }

    /**
     * The message shown to the person. A database error (SQLSTATE, table and
     * column names) is logged instead and replaced with a plain sentence.
     */
    private function safeMessage(\Throwable $e): string
    {
        if ($e instanceof \PDOException) {
            report($e);

            return 'Something went wrong. Please try again.';
        }

        return $e->getMessage();
    }

    // Public: the Course, Year level, and Section choices on the registration form.
    public function registrationOptions(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => [
            'courses' => RegistrationAcademics::courses(),
            'masterlist_required' => \App\Support\Masterlist::required(),
        ]]);
    }

    /*
     * Public: the live check on the Student ID field of the registration form.
     * Says whether the ID is on the masterlist of an active period, and whether that ID already
     * has an account. It never says whose ID it is. Rate limited by its route.
     */
    public function checkStudentId(Request $request): JsonResponse
    {
        $studentId = strtoupper(trim((string) $request->input('student_id', '')));
        if (!preg_match(\App\Support\Masterlist::ID_PATTERN, $studentId)) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors' => ['student_id' => ['Student ID must follow the format 2023-00000-BN-0.']],
            ], 422);
        }

        return response()->json(['success' => true, 'data' => ['status' => \App\Support\Masterlist::idStatus($studentId)]]);
    }

    public function register(Request $request): JsonResponse
    {
        try {
            $this->normalizeRegistrationInput($request);

            $selectedYear = $request->input('year');
            $today = now('Asia/Manila');
            $minimumDate = \Carbon\Carbon::create(
                $today->year - 17,
                $today->month,
                1,
                0,
                0,
                0,
                'Asia/Manila'
            );
            $minimumDate->day(min($today->day, $minimumDate->daysInMonth));
            $minimumBirthday = $minimumDate->toDateString();

            // Course, year, and section options come from Nurse → Course Management.
            $catalog = RegistrationAcademics::courses();
            $selectedCourse = RegistrationAcademics::find($catalog, (string) $request->input('course'));
            $allowedSections = RegistrationAcademics::sectionsFor($selectedCourse, (string) $selectedYear);

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

                    // Same four rules as the Password Strength list on the form:
                    // 8+ and 12+ characters, a number or special character, and both a number
                    // and a special character.
                    'password' => [
                        'required',
                        'string',
                        'min:12',
                        'regex:/\d/',
                        'regex:/[^A-Za-z0-9]/',
                    ],

                    'password_confirmation' => [
                        'required',
                        'string',
                        'same:password',
                    ],

                    'birthday' => [
                        'required',
                        'date_format:Y-m-d',
                        'before_or_equal:' . $minimumBirthday,
                    ],

                    'gender' => [
                        'required',
                        'string',
                        Rule::in([
                            'male',
                            'female',
                        ]),
                    ],

                    'course' => [
                        'required',
                        'string',
                        'max:100',
                        Rule::in(
                            array_column($catalog, 'code')
                        ),
                    ],

                    'year' => [
                        'required',
                        'string',
                        'max:10',
                        Rule::in(
                            RegistrationAcademics::yearsFor($selectedCourse)
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
                        'Password must have 12 or more characters.',

                    'password.regex' =>
                        'Password must have a number and a special character.',

                    'password_confirmation.same' =>
                        'Password confirmation does not match.',

                    'password_confirmation.required' =>
                        'Confirm Password is required.',

                    'birthday.required' =>
                        'Birthday is required.',

                    'birthday.date_format' =>
                        'Birthday format is invalid.',

                    'birthday.before_or_equal' =>
                        'You must be at least 17 years old to register.',

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
                        'Please select a valid section for your course and year level.',

                    'mobile_number.required' =>
                        'Mobile number is required.',

                    'mobile_number.regex' =>
                        'Enter the 10 digits after +63, like 9171234567.',
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
                'message' => $this->safeMessage($e),
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
                'message' => $this->safeMessage($e),
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
                'message' => $this->safeMessage($e),
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
                'message' => $this->safeMessage($e),
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
        // Developer Tools → Remove time Guard is always OFF after signing in.
        TimeGuard::resetFor($result['user']);

        // Correct login resets previous failed attempts.
        $limiter->clear($attemptKey);

        // The token goes in an httpOnly cookie, never in the JSON, so page
        // scripts cannot read it (see App\Support\AuthCookie).
        return response()->json([
            'success' => true,
            'message' => 'Login successful.',
            'user' => $result['user'],
            'expires_in' => $result['expires_in'],
            'role' => $result['role'],
        ], 200)->withCookie(AuthCookie::make($result['token'], 'student'));

    } catch (ValidationException $e) {
        // Missing or malformed form fields are validation errors,
        // not incorrect-credential attempts.
        return response()->json([
            'success' => false,
            'message' => 'Validation failed.',
            'errors' => $e->errors(),
        ], 422);

    } catch (\Throwable $e) {
        if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface && $e->getStatusCode() === 403) {
            return response()->json([
                'success' => false,
                'message' => $this->safeMessage($e),
            ], 403);
        }

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

            // Developer Tools → Remove time Guard is always OFF after signing in.
            TimeGuard::resetFor($result['user']);

            // Token in an httpOnly cookie only (see App\Support\AuthCookie).
            return response()->json([
                'success' => true,
                'message' => 'Login successful.',
                'user' => $result['user'],
                'expires_in' => $result['expires_in'],
                'role' => $result['role'],
            ], 200)->withCookie(AuthCookie::make($result['token'], 'nurse'));

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);

        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $this->safeMessage($e),
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
                    'account_type' => [
                        'required',
                        Rule::in(['student', 'nurse']),
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
                'message' => $this->safeMessage($e),
            ], 400);
        }
    }

    public function verifyPasswordResetOtp(Request $request): JsonResponse
    {
        try {
            $this->normalizeEmailInput($request);
            $data = $request->validate([
                'email' => ['required', 'email', 'max:255'],
                'otp' => ['required', 'string', 'size:6', 'regex:/^\d{6}$/'],
                'account_type' => ['required', Rule::in(['student', 'nurse'])],
            ], [
                'otp.required' => 'Verification code is required.',
                'otp.size' => 'Verification code must contain 6 digits.',
                'otp.regex' => 'Verification code must contain numbers only.',
            ]);

            $result = $this->authService->verifyPasswordResetOtp($data);
            return response()->json([
                'success' => true,
                'message' => $result['message'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $this->safeMessage($e),
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
                    ],
                    'password_confirmation' => [
                        'required',
                        'string',
                        'same:password',
                    ],
                    'account_type' => [
                        'required',
                        Rule::in(['student', 'nurse']),
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

                    'password_confirmation.required' =>
                        'Confirm Password is required.',

                    'password_confirmation.same' =>
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
                'message' => $this->safeMessage($e),
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
                'message' => $this->safeMessage($e),
            ], 400);
        }
    }

    // Open to signed-out requests too, so an expired or invalid session can
    // still clear its cookie. The portal comes from X-Portal, else the user.
    public function logout(Request $request): JsonResponse
    {
        $portal = AuthCookie::requestedPortal($request);

        try {
            if ($user = auth('api')->user()) {
                $portal ??= AuthCookie::portalFor($user);
                // Developer Tools → Remove time Guard never stays on after signing out.
                TimeGuard::resetFor($user);
                $this->authService->logout();
            }
        } catch (\Throwable $e) {
            // Already invalid: clearing the cookie below is all that is left.
        }

        $response = response()->json([
            'success' => true,
            'message' => 'Logged out successfully.',
        ], 200);

        return $portal ? $response->withCookie(AuthCookie::forget($portal)) : $response;
    }

    public function refresh(): JsonResponse
    {
        try {
            $result = $this->authService
                ->refreshToken();

            return response()->json([
                'success' => true,
                'expires_in' => $result['expires_in'],
            ], 200)->withCookie(AuthCookie::make($result['token'], AuthCookie::portalFor(auth('api')->user())));

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

        // Only +639XXXXXXXXX is used. The old 09XXXXXXXXX form is not accepted any more;
        // a number sent without the plus sign (639...) gets it added.
        if (
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
