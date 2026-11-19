import { hasSession } from '../../services/session';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import authService from '../../services/authService';

import {
  Eye,
  EyeOff,
  Loader2,
  UserRound,
  ChevronDown,
  Lock,
  ArrowLeft,
  LockKeyhole,
} from 'lucide-react';

import clinicLogo from '../../assets/clinic-logo.webp';
import campusPhoto from '../../assets/pup-binan-hero.jpg';
import { forgetStudentLogin, getRememberedStudentLogin, rememberStudentLogin } from '../../services/studentRememberLogin';
import { StudentNoticeModal } from '../../components/StudentFeedback';

const LOCK_KEY_PREFIX = 'carelink.student.login-lock.';

const getMinimumBirthday = () => {
  const today = new Date();
  const year = today.getFullYear() - 17;
  const month = today.getMonth() + 1;
  const day = Math.min(today.getDate(), new Date(Date.UTC(year, month, 0)).getUTCDate());
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

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

  const rememberedLogin = useMemo(getRememberedStudentLogin, []);
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
  const [noticeTitle, setNoticeTitle] = useState('Sign-in failed');
  const [noticeHighlight, setNoticeHighlight] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [, setAttemptsRemaining] = useState(null);

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
        { length: 83 },
        (_, index) => currentYear - 17 - index
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
      } else {
        if (getBirthdayValue() > getMinimumBirthday()) {
          nextErrors.birthday =
            'You must be at least 17 years old to sign in.';
        }
      }
    }

    if (!form.password) {
      nextErrors.password = 'Password is required';
    } else if (form.password.length < 5) {
      nextErrors.password = 'Minimum 5 characters';
    }

    setErrors(nextErrors);

    /* Field errors open in the popup instead of expanding the card. */
    const errorList = Object.values(nextErrors);
    if (errorList.length) {
      setNoticeTitle('Check your details');
      setNoticeHighlight('');
      setMessage(errorList.join('\n'));
    }

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
      forgetStudentLogin();
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
    setNoticeTitle('Sign-in failed');
    setNoticeHighlight('');

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
        hasSession('student')
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
          rememberStudentLogin(form);
        } else {
          forgetStudentLogin();
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

        setNoticeTitle('Login temporarily locked');
        setMessage(
          `Too many login attempts. Please wait ${seconds} seconds before trying again.`
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

        const left =
          supplied && Number.isFinite(remaining)
            ? Math.max(0, Math.min(5, Math.trunc(remaining)))
            : null;

        setAttemptsRemaining(left);

        setNoticeHighlight(
          left
            ? `${left} attempt${left === 1 ? '' : 's'} remaining`
            : ''
        );

        setMessage(
          'Student ID, birthday, or password is incorrect.' +
            (left ? ' Login locks for 60 seconds when attempts run out.' : '')
        );
      } else if (status === 403) {
        setAttemptsRemaining(null);
        setMessage(body.message || 'Your student account has been archived. Please contact the clinic for assistance.');
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

  <div className="absolute inset-0 bg-gradient-to-r from-maroon-950/95 via-maroon-800/78 to-maroon-950/35" />

  <div className="absolute inset-0 bg-gradient-to-t from-maroon-950/70 via-transparent to-transparent" />

  {/* Three clear parts: brand (top), title and text (middle), quote (bottom). */}
  <div className="relative z-10 flex w-full flex-col justify-between gap-8 px-8 py-10 text-white xl:px-14 xl:py-12">
    {/* 1. Brand */}
    <Link to="/" className="inline-flex items-center gap-3 self-start">
      <img
        src={clinicLogo}
        alt="PUPBC CareLink clinic logo"
        className="h-12 w-12 rounded-full border border-white/30 bg-white object-cover shadow-lg"
      />
      <span>
        <span className="block text-xl font-extrabold tracking-tight">PUPBC CareLink</span>
        <span className="block text-xs text-white/80">Student Health Portal · PUP Biñan Campus</span>
      </span>
    </Link>

    {/* 2. Title and text */}
    <div className="max-w-xl">
      <h1 className="font-serif text-4xl font-bold leading-[1.1] xl:text-5xl">
        Your Health.<br />Our Priority.
      </h1>
      <p className="mt-5 text-sm font-semibold leading-7 text-white xl:text-base">
        A QR Integrated Health Information System with Self-service Triage Kiosk.
      </p>
      <p className="mt-2 max-w-md text-sm leading-7 text-white/80 xl:text-base">
        Book appointments, access your clinic records and stay connected with campus health services.
      </p>
    </div>

    {/* 3. Quote and campus */}
    <div className="flex items-end justify-between gap-4 text-white/90">
      <p className="max-w-xs font-serif text-lg italic leading-6">
        “Smarter campus healthcare for every Iskolar ng Bayan.”
      </p>
      <p className="text-right text-xs leading-5 text-white/75">
        Polytechnic University of the Philippines<br />Biñan Campus
      </p>
    </div>
  </div>
</div>


      {/* Original login panel */}
      <div className="relative isolate flex-1 flex items-center justify-center overflow-hidden px-4 py-8 lg:w-1/2 lg:bg-[#F8F9FC] lg:py-12 xl:w-2/5">
  <img
    src={campusPhoto}
    alt=""
    className="absolute inset-0 -z-20 h-full w-full object-cover object-center lg:hidden"
  />
  <div className="absolute inset-0 -z-10 bg-gradient-to-b from-maroon-950/88 via-maroon-800/70 to-maroon-950/90 lg:hidden" />
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-lg mb-3 p-1.5">
              <img
                src={clinicLogo}
                alt="PUPBC CareLink logo"
                className="w-full h-full object-cover rounded-full"
              />
            </div>

            {/* Sits on the maroon photo overlay in both themes, so it stays light. */}
            <h1 className="text-2xl font-bold text-white drop-shadow-sm">
              PUPBC CareLink
            </h1>

            <p className="text-sm font-medium text-white/90 mt-1">
              Student Portal
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-[10px] shadow-xl p-6 sm:p-8 border border-gray-100 dark:border-gray-700 animate-fadeInUp">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                Welcome Back, Isko&apos;t Iska!
              </h2>

              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Login to access your student portal
              </p>
            </div>

            {/* Sign-in errors open as a popup */}
            <StudentNoticeModal
              open={Boolean(message)}
              title={noticeTitle}
              highlight={noticeHighlight}
              message={message}
              actionLabel="Try again"
              onClose={() => setMessage('')}
            />

            {/* Lock and attempt info are shown in the popup; the Sign In
                button keeps the live countdown, so the card never resizes. */}

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
              autoComplete="off"
              noValidate
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
                    <UserRound className="w-5 h-5" />
                  </div>

                  <input
                    id="student-id"
                    className={`w-full border rounded-[10px] pl-10 pr-4 py-3 text-sm focus:outline-none transition-all dark:bg-gray-700 dark:text-white ${
                      errors.student_id
                        ? 'border-red-400 focus:border-red-500 dark:border-red-500'
                        : 'border-slate-200 dark:border-gray-600 focus:border-maroon-800 hover:border-maroon-300'
                    }`}
                    type="text"
                    name="student_id"
                    value={form.student_id}
                    onChange={handleChange}
                    placeholder="2016-00000-BN-0"
                    maxLength={17}
                    autoComplete="off"
                    inputMode="text"
                    required
                  />
                </div>

              </div>

              {/* Birthday */}
              <div>
                <label className="font-semibold text-sm text-gray-700 dark:text-gray-300 pb-1 block">
                  Birthday
                </label>

                <div className="grid grid-cols-[1.35fr_0.8fr_1fr] gap-2">
                  <span className="relative block min-w-0">
                    <label htmlFor="dob-month" className="sr-only">
                      Birth month
                    </label>

                    <select
                      id="dob-month"
                      name="dobMonth"
                      value={form.dobMonth}
                      onChange={handleChange}
                      className="peer w-full min-w-0 cursor-pointer appearance-none rounded-[10px] border border-slate-200 bg-white py-2.5 pl-2 pr-7 text-sm text-gray-900 focus:border-maroon-800 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      required
                    >
                      <option value="">Month</option>

                      {MONTHS.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 peer-disabled:opacity-50 dark:text-gray-500" />
                  </span>

                  <span className="relative block min-w-0">
                    <label htmlFor="dob-day" className="sr-only">
                      Birth day
                    </label>

                    <select
                      id="dob-day"
                      name="dobDay"
                      value={form.dobDay}
                      onChange={handleChange}
                      className="peer w-full min-w-0 cursor-pointer appearance-none rounded-[10px] border border-slate-200 bg-white py-2.5 pl-2 pr-7 text-sm text-gray-900 focus:border-maroon-800 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      required
                    >
                      <option value="">Day</option>

                      {birthDays.map((day) => (
                        <option key={day} value={String(day).padStart(2, '0')}>
                          {day}
                        </option>
                      ))}
                    </select>
                    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 peer-disabled:opacity-50 dark:text-gray-500" />
                  </span>

                  <span className="relative block min-w-0">
                    <label htmlFor="dob-year" className="sr-only">
                      Birth year
                    </label>

                    <select
                      id="dob-year"
                      name="dobYear"
                      value={form.dobYear}
                      onChange={handleChange}
                      className="peer w-full min-w-0 cursor-pointer appearance-none rounded-[10px] border border-slate-200 bg-white py-2.5 pl-2 pr-7 text-sm text-gray-900 focus:border-maroon-800 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      required
                    >
                      <option value="">Year</option>

                      {birthYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 peer-disabled:opacity-50 dark:text-gray-500" />
                  </span>
                </div>

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
                    className={`w-full border rounded-[10px] pl-10 pr-12 py-3 text-sm focus:outline-none transition-all dark:bg-gray-700 dark:text-white ${
                      errors.password
                        ? 'border-red-400 focus:border-red-500 dark:border-red-500'
                        : 'border-slate-200 dark:border-gray-600 focus:border-maroon-800 hover:border-maroon-300'
                    }`}
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    autoComplete="off"
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((current) => !current)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-[10px] hover:bg-gray-100 dark:hover:bg-gray-600"
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
                className="w-full py-3 px-4 bg-maroon-800 text-white hover:text-gray-300 font-semibold rounded-full transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <>
                    <LockKeyhole className="w-5 h-5" />
                    <span>Sign In</span>
                  </>
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
                  className="font-semibold text-maroon-600 dark:text-maroon-400 hover:text-maroon-800 dark:hover:text-maroon-300 transition-colors inline-flex items-center"
                >
                  <span>Create Account</span>
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
