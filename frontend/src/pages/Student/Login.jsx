
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import authService from '../../services/authService';

import {
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  Hash,
  Calendar,
  Lock,
  ArrowLeft,
} from 'lucide-react';

import clinicLogo from '../../assets/clinic logo.jpg';
import campusPhoto from '../../assets/pup-binan-hero.jpg';

const REMEMBER_LOGIN_KEY = 'carelink.student.remember-login';
const LOCK_KEY_PREFIX = 'carelink.student.login-lock.';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
].map((label, index) => ({
  label,
  value: String(index + 1).padStart(2, '0'),
}));

const getRememberedLogin = () => {
  const empty = {
    enabled: false,
    student_id: '',
    dobMonth: '',
    dobDay: '',
    dobYear: '',
  };

  try {
    const saved = JSON.parse(
      localStorage.getItem(REMEMBER_LOGIN_KEY) || '{}'
    );

    return {
      enabled: saved.enabled === true,
      student_id: saved.student_id || '',
      dobMonth: saved.dobMonth || '',
      dobDay: saved.dobDay || '',
      dobYear: saved.dobYear || '',
    };
  } catch {
    return empty;
  }
};

const formatStudentId = (value) => {
  const clean = String(value)
    .toUpperCase()
    .replace(/[^0-9BN]/g, '');

  if (clean.length <= 4) return clean;

  if (clean.length <= 9) {
    return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  }

  if (clean.length <= 11) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 9)}-${clean.slice(9)}`;
  }

  return `${clean.slice(0, 4)}-${clean.slice(4, 9)}-${clean.slice(9, 11)}-${clean.slice(11, 12)}`;
};

// Display-only countdown.
// Laravel remains responsible for enforcing the actual lock.
const getSavedLockUntil = (studentId) => {
  if (!studentId) return 0;

  try {
    const expiresAt = Number(
      sessionStorage.getItem(LOCK_KEY_PREFIX + studentId)
    );

    if (
      Number.isFinite(expiresAt) &&
      expiresAt > Date.now()
    ) {
      return expiresAt;
    }

    sessionStorage.removeItem(LOCK_KEY_PREFIX + studentId);
  } catch {
    // Server-side lock remains effective.
  }

  return 0;
};

const Login = () => {
  const navigate = useNavigate();

  const rememberedLogin = useMemo(getRememberedLogin, []);
  const submittingRef = useRef(false);

  const [form, setForm] = useState({
    student_id: rememberedLogin.student_id,
    password: '',
    dobMonth: rememberedLogin.dobMonth,
    dobDay: rememberedLogin.dobDay,
    dobYear: rememberedLogin.dobYear,
  });

  const [rememberMe, setRememberMe] = useState(
    rememberedLogin.enabled
  );

  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [attemptsRemaining, setAttemptsRemaining] = useState(null);

  const [lockUntil, setLockUntil] = useState(
    () => getSavedLockUntil(rememberedLogin.student_id)
  );

  const [now, setNow] = useState(Date.now());

  const lockSeconds = Math.max(
    0,
    Math.ceil((lockUntil - now) / 1000)
  );

  const isLocked = lockSeconds > 0;

  const currentYear = new Date().getFullYear();

  const birthYears = useMemo(
    () =>
      Array.from(
        { length: 100 },
        (_, index) => currentYear - index
      ),
    [currentYear]
  );

  const birthDays = useMemo(() => {
    const maxDay =
      form.dobMonth && form.dobYear
        ? new Date(
            Number(form.dobYear),
            Number(form.dobMonth),
            0
          ).getDate()
        : 31;

    return Array.from(
      { length: maxDay },
      (_, index) => index + 1
    );
  }, [form.dobMonth, form.dobYear]);

  /*
   * Restore the countdown for the entered Student ID.
   */
  useEffect(() => {
    setLockUntil(getSavedLockUntil(form.student_id));
    setNow(Date.now());
    setAttemptsRemaining(null);
  }, [form.student_id]);

  /*
   * Countdown. The backend still decides whether login
   * is allowed, even after refreshing this page.
   */
  useEffect(() => {
    if (!lockUntil) return undefined;

    const tick = () => {
      const current = Date.now();
      setNow(current);

      if (current >= lockUntil) {
        try {
          sessionStorage.removeItem(
            LOCK_KEY_PREFIX + form.student_id
          );
        } catch {
          // Ignore storage restrictions.
        }

        setLockUntil(0);
        setAttemptsRemaining(null);
        setMessage('');
      }
    };

    tick();

    const timer = window.setInterval(tick, 1000);

    return () => window.clearInterval(timer);
  }, [lockUntil, form.student_id]);

  const getBirthdayValue = () => {
    if (
      !form.dobMonth ||
      !form.dobDay ||
      !form.dobYear
    ) {
      return '';
    }

    return `${form.dobYear}-${String(form.dobMonth).padStart(2, '0')}-${String(form.dobDay).padStart(2, '0')}`;
  };

  const validate = () => {
    const nextErrors = {};

    if (!form.student_id.trim()) {
      nextErrors.student_id = 'Student ID is required';
    } else if (
      !/^\d{4}-\d{5}-BN-[01]$/.test(form.student_id)
    ) {
      nextErrors.student_id =
        'Format: 2016-00000-BN-0 or BN-1';
    }

    if (
      !form.dobMonth ||
      !form.dobDay ||
      !form.dobYear
    ) {
      nextErrors.birthday = 'Birthday is required';
    } else {
      const year = Number(form.dobYear);
      const month = Number(form.dobMonth);
      const day = Number(form.dobDay);

      const actual = new Date(
        Date.UTC(year, month - 1, day)
      );

      const correctDate =
        actual.getUTCFullYear() === year &&
        actual.getUTCMonth() === month - 1 &&
        actual.getUTCDate() === day;

      if (!correctDate) {
        nextErrors.birthday =
          'Please enter a valid birthday';
      } else if (actual.getTime() > Date.now()) {
        nextErrors.birthday =
          'Birthday cannot be in the future';
      }
    }

    if (!form.password) {
      nextErrors.password = 'Password is required';
    } else if (form.password.length < 5) {
      nextErrors.password = 'Minimum 5 characters';
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    const nextValue =
      name === 'student_id'
        ? formatStudentId(value)
        : value;

    setForm((current) => {
      const updated = {
        ...current,
        [name]: nextValue,
      };

      if (
        (name === 'dobMonth' || name === 'dobYear') &&
        updated.dobMonth &&
        updated.dobYear &&
        updated.dobDay
      ) {
        const maxDay = new Date(
          Number(updated.dobYear),
          Number(updated.dobMonth),
          0
        ).getDate();

        if (Number(updated.dobDay) > maxDay) {
          updated.dobDay = '';
        }
      }

      return updated;
    });

    setErrors((current) => ({
      ...current,
      [name]: '',
      ...(name.startsWith('dob')
        ? { birthday: '' }
        : {}),
    }));

    if (!isLocked) {
      setMessage('');
    }
  };

  const handleRememberChange = (event) => {
    const checked = event.target.checked;

    setRememberMe(checked);

    if (!checked) {
      localStorage.removeItem(REMEMBER_LOGIN_KEY);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Prevent duplicate requests from rapid clicking.
    if (
      submittingRef.current ||
      isLocked ||
      !validate()
    ) {
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setMessage('');

    try {
      /*
       * Only one request.
       * No separate artificial 10-second timer.
       * Axios already has its own network timeout.
       */
      const response = await authService.login(
        form.student_id,
        form.password,
        getBirthdayValue()
      );

      if (
        response?.success &&
        localStorage.getItem('token')
      ) {
        setAttemptsRemaining(null);
        setLockUntil(0);

        try {
          sessionStorage.removeItem(
            LOCK_KEY_PREFIX + form.student_id
          );
        } catch {
          // Ignore storage restrictions.
        }

        /*
         * Remember only Student ID and birthday.
         * Never save the password.
         */
        if (rememberMe) {
          localStorage.setItem(
            REMEMBER_LOGIN_KEY,
            JSON.stringify({
              enabled: true,
              student_id: form.student_id,
              dobMonth: form.dobMonth,
              dobDay: form.dobDay,
              dobYear: form.dobYear,
            })
          );
        } else {
          localStorage.removeItem(REMEMBER_LOGIN_KEY);
        }

        navigate('/student', {
          replace: true,
        });
      } else {
        setMessage(
          'Unable to sign in. Please try again.'
        );
      }
    } catch (error) {
      const status = error.response?.status;
      const body = error.response?.data || {};

      if (status === 429) {
        /*
         * The backend decides the actual lock duration.
         */
        const rawSeconds = Number(
          body.retry_after ??
          error.response?.headers?.['retry-after']
        );

        const seconds =
          Number.isFinite(rawSeconds) && rawSeconds > 0
            ? Math.ceil(rawSeconds)
            : 60;

        const expiresAt =
          Date.now() + seconds * 1000;

        setLockUntil(expiresAt);
        setNow(Date.now());
        setAttemptsRemaining(0);

        try {
          sessionStorage.setItem(
            LOCK_KEY_PREFIX + form.student_id,
            String(expiresAt)
          );
        } catch {
          // Laravel still enforces the actual lock.
        }

        setMessage(
          'Too many login attempts. Please wait before trying again.'
        );
      } else if (status === 401) {
        /*
         * Only show remaining attempts when the backend
         * has actually returned that value.
         */
        const supplied =
          body.attempts_remaining !== undefined &&
          body.attempts_remaining !== null;

        const remaining = Number(
          body.attempts_remaining
        );

        if (
          supplied &&
          Number.isFinite(remaining)
        ) {
          setAttemptsRemaining(
            Math.max(
              0,
              Math.min(5, Math.trunc(remaining))
            )
          );
        } else {
          setAttemptsRemaining(null);
        }

        setMessage(
          'Student ID, birthday, or password is incorrect.'
        );
      } else if (status === 422) {
        setMessage(
          'Please check your Student ID, birthday, and password.'
        );
      } else if (error.code === 'ECONNABORTED') {
        setMessage(
          'The request timed out. Please check your connection and try again.'
        );
      } else if (!error.response) {
        setMessage(
          'Cannot connect to CareLink. Make sure the backend server is running.'
        );
      } else {
        setMessage(
          'Unable to sign in right now. Please try again later.'
        );
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      
{/* Desktop branding — clean campus photo, no dots or grid */}
<div className="relative hidden min-h-screen overflow-hidden lg:flex lg:w-1/2 xl:w-3/5">
  <img
    src={campusPhoto}
    alt="PUP Biñan Campus"
    className="absolute inset-0 h-full w-full object-cover object-[60%_center]"
  />

  <div className="absolute inset-0 bg-gradient-to-r from-[#4D0D1B]/95 via-[#741126]/78 to-[#4D0D1B]/35" />

  <div className="absolute inset-0 bg-gradient-to-t from-[#4D0D1B]/70 via-transparent to-transparent" />

  <div className="relative z-10 flex w-full flex-col items-center justify-center px-8 py-12 text-center text-white xl:px-14">
    <div className="mb-7 flex h-28 w-28 items-center justify-center rounded-full border border-white/30 bg-white/15 p-3 shadow-xl backdrop-blur-sm">
      <img
        src={clinicLogo}
        alt="PUPBC CareLink clinic logo"
        className="h-full w-full rounded-full object-cover"
      />
    </div>

    <h1 className="text-4xl font-extrabold tracking-tight xl:text-5xl">
      PUPBC <span className="text-rose-200">CareLink</span>
    </h1>

    <p className="mt-4 max-w-md text-lg font-semibold text-white/95">
      Polytechnic University of the Philippines
    </p>

    <p className="mt-1 text-sm font-medium text-rose-100">
      Biñan Campus
    </p>

    <div className="my-8 h-px w-20 bg-rose-200/70" />

    <h2 className="max-w-md text-2xl font-bold leading-tight">
      Your Health. Our Priority.
    </h2>

    <p className="mt-4 max-w-md text-sm leading-7 text-rose-100/90">
      A QR Integrated Health Information System with
      Self-service Triage Kiosk.
    </p>

    <p className="mt-3 max-w-sm text-sm leading-6 text-white/75">
      Book appointments, access your clinic records and stay
      connected with campus health services.
    </p>

    <p className="mt-10 font-serif text-lg italic text-rose-100">
      “Smarter campus healthcare for every Iskolar ng Bayan.”
    </p>

    <p className="mt-12 text-xs text-white/55">
      PUPBC CareLink · Student Health Portal
    </p>
  </div>
</div>


      {/* Original login panel */}
      <div className="relative isolate flex-1 flex items-center justify-center overflow-hidden px-4 py-8 lg:w-1/2 lg:bg-[#F8F9FC] lg:py-12 xl:w-2/5">
  <img
    src={campusPhoto}
    alt=""
    className="absolute inset-0 -z-20 h-full w-full object-cover object-center lg:hidden"
  />
  <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#4D0D1B]/88 via-[#741126]/70 to-[#4D0D1B]/90 lg:hidden" />
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-lg mb-3 p-1.5">
              <img
                src={clinicLogo}
                alt="PUPBC CareLink logo"
                className="w-full h-full object-cover rounded-full"
              />
            </div>

            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              PUPBC CareLink
            </h1>

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Student Portal
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-6 sm:p-8 border border-gray-100 dark:border-gray-700 animate-fadeInUp">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                Welcome Back, Isko&apos;t Iska!
              </h2>

              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Login to access your student portal
              </p>
            </div>

            {message && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-xl text-sm text-center animate-shake bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
              >
                {message}
              </div>
            )}

            {isLocked && (
              <div
                role="status"
                aria-live="polite"
                className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
              >
                Login temporarily locked. Try again in{' '}
                <strong>{lockSeconds}s</strong>.
              </div>
            )}

            {!isLocked &&
              attemptsRemaining !== null &&
              attemptsRemaining > 0 && (
                <p className="mb-4 text-center text-xs font-medium text-amber-700 dark:text-amber-300">
                  {attemptsRemaining} attempt
                  {attemptsRemaining === 1 ? '' : 's'} remaining
                  before a 60-second lock.
                </p>
              )}

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
              autoComplete="on"
            >
              {/* Student ID */}
              <div>
                <label
                  htmlFor="student-id"
                  className="font-semibold text-sm text-gray-700 dark:text-gray-300 pb-1 block"
                >
                  Student ID
                </label>

                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Hash className="w-5 h-5" />
                  </div>

                  <input
                    id="student-id"
                    className={`w-full border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all dark:bg-gray-700 dark:text-white ${
                      errors.student_id
                        ? 'border-red-300 focus:ring-red-400 bg-red-50 dark:bg-red-900/20'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-maroon-500 hover:border-maroon-300'
                    }`}
                    type="text"
                    name="student_id"
                    value={form.student_id}
                    onChange={handleChange}
                    placeholder="2016-00000-BN-0"
                    maxLength={17}
                    autoComplete="username"
                    inputMode="text"
                    required
                  />
                </div>

                {errors.student_id && (
                  <p className="text-red-500 text-xs mt-1 ml-1">
                    {errors.student_id}
                  </p>
                )}
              </div>

              {/* Birthday */}
              <div>
                <label className="font-semibold text-sm text-gray-700 dark:text-gray-300 pb-1 block">
                  Birthday
                </label>

                <div
                  className={`rounded-xl border p-3 transition-all ${
                    errors.birthday
                      ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
                      : 'border-gray-300 bg-white hover:border-maroon-300 dark:border-gray-600 dark:bg-gray-700'
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />

                    <p className="text-xs font-medium text-gray-500 dark:text-gray-300">
                      Month / Day / Year
                    </p>
                  </div>

                  <div className="grid grid-cols-[1.35fr_0.8fr_1fr] gap-2">
                    <div>
                      <label
                        htmlFor="dob-month"
                        className="sr-only"
                      >
                        Birth month
                      </label>

                      <select
                        id="dob-month"
                        name="dobMonth"
                        value={form.dobMonth}
                        onChange={handleChange}
                        className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-maroon-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        required
                      >
                        <option value="">Month</option>

                        {MONTHS.map((month) => (
                          <option
                            key={month.value}
                            value={month.value}
                          >
                            {month.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="dob-day"
                        className="sr-only"
                      >
                        Birth day
                      </label>

                      <select
                        id="dob-day"
                        name="dobDay"
                        value={form.dobDay}
                        onChange={handleChange}
                        className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-maroon-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        required
                      >
                        <option value="">Day</option>

                        {birthDays.map((day) => (
                          <option
                            key={day}
                            value={String(day).padStart(2, '0')}
                          >
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="dob-year"
                        className="sr-only"
                      >
                        Birth year
                      </label>

                      <select
                        id="dob-year"
                        name="dobYear"
                        value={form.dobYear}
                        onChange={handleChange}
                        className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-maroon-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        required
                      >
                        <option value="">Year</option>

                        {birthYears.map((year) => (
                          <option
                            key={year}
                            value={year}
                          >
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {errors.birthday && (
                  <p className="text-red-500 text-xs mt-1 ml-1">
                    {errors.birthday}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="student-password"
                  className="font-semibold text-sm text-gray-700 dark:text-gray-300 pb-1 block"
                >
                  Password
                </label>

                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Lock className="w-5 h-5" />
                  </div>

                  <input
                    id="student-password"
                    className={`w-full border rounded-xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 transition-all dark:bg-gray-700 dark:text-white ${
                      errors.password
                        ? 'border-red-300 focus:ring-red-400 bg-red-50 dark:bg-red-900/20'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-maroon-500 hover:border-maroon-300'
                    }`}
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((current) => !current)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                    title={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                  >
                    {showPassword ? (
                      <Eye className="w-5 h-5" />
                    ) : (
                      <EyeOff className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {errors.password && (
                  <p className="text-red-500 text-xs mt-1 ml-1">
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Remember Me and Forgot Password */}
              <div className="flex items-center justify-between gap-3">
                <label className="flex cursor-pointer select-none items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={handleRememberChange}
                    className="h-4 w-4 rounded border-gray-300 accent-maroon-800 dark:border-gray-600"
                  />

                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Remember me
                  </span>
                </label>

                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-maroon-600 dark:text-maroon-400 hover:text-maroon-800 dark:hover:text-maroon-300 transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>

              {/* Sign In */}
              <button
                className="w-full py-3 px-4 bg-gradient-to-r from-maroon-800 to-maroon-900 hover:from-maroon-900 hover:to-maroon-950 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                type="submit"
                disabled={loading || isLocked}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : isLocked ? (
                  `Try again in ${lockSeconds}s`
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />

              <span className="px-4 text-xs text-gray-400 dark:text-gray-500 uppercase font-medium">
                or
              </span>

              <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Don&apos;t have an account?{' '}

                <Link
                  to="/register"
                  className="font-semibold text-maroon-600 dark:text-maroon-400 hover:text-maroon-800 dark:hover:text-maroon-300 transition-colors inline-flex items-center space-x-1"
                >
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </p>
            </div>
          </div>

          <div className="text-center mt-4">
            <Link
              to="/"
              className="text-xs text-gray-400 dark:text-gray-500 hover:underline inline-flex items-center space-x-1"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;