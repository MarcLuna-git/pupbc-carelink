import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2, ChevronDown, Circle, Eye, EyeOff, FileText,
  GraduationCap, Loader2, LockKeyhole, Mail,
  ShieldCheck, UserRound, UserRoundX, X, XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import authService from '../../services/authService';
import { formatPersonName } from '../../utils/studentUser';
import { isStudentIdYearPrefix, isValidStudentIdYear } from '../../utils/inputFilters';
import clinicLogo from '../../assets/clinic-logo.webp';
import campusPhoto from '../../assets/pup-binan-hero.jpg';
import clinicPhoto from '../../assets/clinic-waiting-area.jpg';
import { StudentNoticeModal, StudentToast } from '../../components/StudentFeedback';
import PhilippineMobileInput from '../../components/PhilippineMobileInput';
import { contactPhoneError } from '../../utils/contactValidation';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const INITIAL = {
  student_id: '', first_name: '', middle_name: '', last_name: '',
  dobMonth: '', dobDay: '', dobYear: '', gender: '',
  email: '', mobile_number: '', course: '', year: '', section: '',
  password: '', password_confirmation: '', agree_terms: false,
};
const INPUT = 'min-h-11 w-full min-w-0 rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-maroon-800 focus:ring-2 focus:ring-maroon-800/15 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-rose-300 dark:focus:ring-rose-300/25 disabled:cursor-not-allowed disabled:opacity-60';
const STUDENT_ID_PATTERN = /^\d{4}-\d{5}-BN-[01]$/;
const ID_NOT_FOUND = 'This Student ID is not on the school list. Check it, or visit the clinic for help.';
const ID_REGISTERED = 'This Student ID already has an account. Sign in instead.';
const INVALID = 'border-red-400! focus:border-red-500 focus:ring-red-500/15 dark:border-red-400! dark:focus:border-red-400 dark:focus:ring-red-400/25';

function getManilaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (name) => parts.find((item) => item.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function getMinimumBirthday() {
  const [year, month, day] = getManilaDate().split('-').map(Number);
  const minimumYear = year - 17;
  const minimumDay = Math.min(day, new Date(Date.UTC(minimumYear, month, 0)).getUTCDate());
  return `${minimumYear}-${String(month).padStart(2, '0')}-${String(minimumDay).padStart(2, '0')}`;
}
function birthdayOf(form) {
  return form.dobYear && form.dobMonth && form.dobDay
    ? `${form.dobYear}-${form.dobMonth}-${form.dobDay}` : '';
}
function isValidBirthday(year, month, day) {
  const date = new Date(Date.UTC(+year, +month - 1, +day));
  return date.getUTCFullYear() === +year &&
    date.getUTCMonth() === +month - 1 && date.getUTCDate() === +day;
}
function formatStudentId(value) {
  let digits = '';
  let suffix = '';
  let finalDigit = '';
  const input = String(value).toUpperCase();

  for (const char of input) {
    if (/\d/.test(char)) {
      if (digits.length < 4) {
        if (isStudentIdYearPrefix(digits + char)) digits += char;
      } else if (digits.length < 9) digits += char;
      else if (suffix === 'BN' && /^[01]$/.test(char)) finalDigit = char;
    } else if (digits.length === 9 && /^[BN]$/.test(char) && suffix.length < 2) {
      const expected = suffix.length === 0 ? 'B' : 'N';
      if (char === expected) suffix += char;
    }
  }

  const year = digits.slice(0, 4);
  const studentNumber = digits.slice(4);
  let formatted = year;
  if (studentNumber) formatted += `-${studentNumber}`;
  if (suffix) formatted += `-${suffix}`;
  if (finalDigit) formatted += `-${finalDigit}`;
  return formatted;
}

// The Student ID field drops any key that does not fit 2023-00000-BN-0. This tells the student
// why the key they just typed did not show up. Empty when nothing was dropped.
function studentIdTypingNote(typed, formatted) {
  const wanted = String(typed).toUpperCase().replace(/[-\s]/g, '');
  const kept = formatted.replace(/-/g, '');
  if (wanted.length <= kept.length) return '';
  if (kept.length < 4) return `The year must be from 2000 to ${new Date().getFullYear()}.`;
  if (kept.length < 9) return 'Use numbers only for the 5 digits after the year.';
  if (kept.length < 11) return 'Type BN after the 5 digits.';
  if (kept.length < 12) return 'The last number must be 0 or 1.';
  return 'Your Student ID is already complete.';
}

function apiMessage(error, fallback) {
  const status = error?.response?.status;
  if (status === 429) return 'Too many requests. Please wait and try again.';
  if (status >= 500) return 'The server is temporarily unavailable. Please try again later.';
  if (!error?.response) return 'Cannot connect to CareLink. Check your connection and backend server.';
  return error.response.data?.message || fallback;
}
// Password Strength list: all four must be met before the student can sign up
// (the server checks the same rules).
const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { label: 'A number or a special character', test: (value) => /[\d\W_]/.test(value) },
  { label: '12 or more characters', test: (value) => value.length >= 12 },
  { label: 'Both a number and a special character', test: (value) => /\d/.test(value) && /[^A-Za-z0-9]/.test(value) },
];

function Field({ id, label, error, optional, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}{optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
      </label>
      {children}
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{Array.isArray(error) ? error[0] : error}</p>}
    </div>
  );
}
function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-maroon-800 text-white dark:bg-maroon-700">
        <Icon size={17} />
      </span>
      <h3 className="text-sm font-extrabold text-slate-900">{children}</h3>
    </div>
  );
}

// The look of the Student ID field for each live check result: icon, color and the line under it.
const ID_STATES = {
  typing: { icon: Loader2, spin: true, tone: 'text-slate-400 dark:text-slate-500', text: '' },
  // While typing, when the masterlist check is on: tell the student what the ID is checked against.
  typingRequired: { icon: Loader2, spin: true, tone: 'text-slate-500 dark:text-slate-400', text: 'Your Student ID must be on the school list to sign up...' },
  checking: { icon: Loader2, spin: true, tone: 'text-maroon-800 dark:text-rose-300', text: 'Checking the school list...' },
  found: { icon: CheckCircle2, tone: 'text-green-600 dark:text-green-400', text: 'Found on the school list.' },
  // The masterlist check is off: nothing was verified, so no check mark is shown.
  format: { icon: null, tone: '', text: '' },
  // On the list, but the ID already has an account: a different icon than "not found", same red.
  registered: { icon: UserRoundX, tone: 'text-red-600 dark:text-red-400', text: ID_REGISTERED },
  not_found: { icon: XCircle, tone: 'text-red-600 dark:text-red-400', text: ID_NOT_FOUND },
  busy: { icon: XCircle, tone: 'text-amber-600 dark:text-amber-400', text: 'Too many checks. Wait a minute, then type your Student ID again.' },
  error: { icon: XCircle, tone: 'text-amber-600 dark:text-amber-400', text: 'We could not check the school list right now. You can still continue.' },
};

function StudentIdField({ value, onChange, disabled, error, check, required }) {
  // No icon while empty; a spinner while the student types and while the list is checked;
  // then a check or an X.
  const result = check.id === value ? ID_STATES[check.status] : null;
  const current = result || (value ? ID_STATES[required ? 'typingRequired' : 'typing'] : null);
  const Icon = current?.icon;
  const taken = result && check.status === 'registered';
  const bad = !taken && (Boolean(error) || (result && check.status === 'not_found'));
  const note = (taken || !error) && current?.text;
  return (
    <Field id="student_id" label="Student ID" error={taken ? null : error}>
      <div className="relative">
        <input
          id="student_id" name="student_id" type="text" value={value} onChange={onChange}
          placeholder="2023-00000-BN-0" autoComplete="off" maxLength={17} disabled={disabled}
          aria-invalid={bad || taken} aria-describedby={note ? 'student-id-check' : undefined}
          className={`${INPUT} pr-11`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-0 flex w-11 items-center justify-center" aria-hidden="true">
          <AnimatePresence mode="wait" initial={false}>
            {Icon && <motion.span
              key={current.spin ? 'spin' : check.status}
              initial={{ scale: 0.4, opacity: 0, rotate: current?.spin ? 0 : -90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}
              className={`flex ${current.tone}`}
            >
              <Icon size={19} className={current.spin ? 'animate-spin' : ''} />
            </motion.span>}
          </AnimatePresence>
        </span>
      </div>
      {note && <p id="student-id-check" role="status" aria-live="polite" className={`mt-1 text-xs ${current.tone}`}>
        {taken ? <>This Student ID already has an account. <Link to="/login" className="font-semibold underline">Sign in</Link> instead.</> : note}
      </p>}
    </Field>
  );
}

// ── Live check for plain text fields (same look as the Student ID field) ──────────────
// A short wait after the last key, then a green check or a red X. No server call.
const CHECK_DELAY_MS = 600;

// Error text for a person's name, or '' when it looks right. `what` is e.g. 'first name'.
function personNameError(value, what) {
  const name = String(value ?? '').trim();
  if (!name) return `Enter your ${what}.`;
  if (!/^[\p{L}\s\-'.]+$/u.test(name)) return 'Use letters only.';
  if (name.replace(/[^\p{L}]/gu, '').length < 2) return `Your ${what} is too short.`;
  if (name.length > 100) return `Your ${what} is too long.`;
  return '';
}
const firstNameError = (value) => personNameError(value, 'first name');
const lastNameError = (value) => personNameError(value, 'last name');

// Email format only (no server call, so the field cannot be used to find out who is registered).
function emailError(value) {
  const email = String(value ?? '').trim();
  if (!email) return 'Enter your email address.';
  if (email.length > 255) return 'Your email address is too long.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return 'Enter a valid email, like name@example.com.';
  return '';
}

// idle (empty) | typing | valid | invalid, with the error text when invalid.
function useTypingCheck(value, check) {
  const [done, setDone] = useState({ value: '', error: '' });
  useEffect(() => {
    if (!value) return undefined;
    const timer = window.setTimeout(() => setDone({ value, error: check(value) }), CHECK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [value, check]);
  if (!value) return { status: 'idle', error: '' };
  if (done.value !== value) return { status: 'typing', error: '' };
  return done.error ? { status: 'invalid', error: done.error } : { status: 'valid', error: '' };
}

const CHECK_LOOKS = {
  typing: { icon: Loader2, spin: true, tone: 'text-slate-400 dark:text-slate-500' },
  valid: { icon: CheckCircle2, tone: 'text-green-600 dark:text-green-400' },
  invalid: { icon: XCircle, tone: 'text-red-600 dark:text-red-400' },
};

// Text input with the live check icon on the right (the icon shows the result; the border stays
// plain). A submit error (`error`) wins over the live one.
function CheckedField({ id, label, value, onChange, check, disabled, error, optional, type = 'text', icon: LeftIcon, ...inputProps }) {
  const live = useTypingCheck(value, check);
  const look = CHECK_LOOKS[live.status];
  const Icon = look?.icon;
  const shownError = error || live.error;
  const bad = Boolean(error) || live.status === 'invalid';
  return (
    <Field id={id} label={label} optional={optional} error={shownError}>
      <div className="relative">
        {LeftIcon && <LeftIcon size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" aria-hidden="true" />}
        <input
          {...inputProps}
          id={id} name={id} type={type} value={value} onChange={onChange} disabled={disabled}
          aria-invalid={bad}
          className={`${INPUT} pr-11 ${LeftIcon ? 'pl-9' : ''}`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-0 flex w-11 items-center justify-center" aria-hidden="true">
          <AnimatePresence mode="wait" initial={false}>
            {Icon && <motion.span
              key={live.status}
              initial={{ scale: 0.4, opacity: 0, rotate: look.spin ? 0 : -90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}
              className={`flex ${error ? CHECK_LOOKS.invalid.tone : look.tone}`}
            >
              <Icon size={19} className={look.spin ? 'animate-spin' : ''} />
            </motion.span>}
          </AnimatePresence>
        </span>
      </div>
    </Field>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const submitRef = useRef(false);
  const resendRef = useRef(false);
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('error');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [legalModal, setLegalModal] = useState(null);
  const [courses, setCourses] = useState([]);
  const [catalogStatus, setCatalogStatus] = useState('loading'); // loading | ready | empty | error
  const [masterlistRequired, setMasterlistRequired] = useState(false);
  // Live Student ID check: idle | format | checking | found | not_found | error
  const [idCheck, setIdCheck] = useState({ status: 'idle', id: '' });

  const loadCatalog = async () => {
    setCatalogStatus('loading');
    try {
      const { courses: list, masterlistRequired: required } = await authService.registrationSettings();
      setCourses(list);
      setMasterlistRequired(required);
      setCatalogStatus(list.length ? 'ready' : 'empty');
    } catch {
      setCatalogStatus('error');
    }
  };
  useEffect(() => { loadCatalog(); }, []);

  const years = useMemo(() => {
    const current = Number(getManilaDate().slice(0, 4));
    return Array.from({ length: 83 }, (_, index) => current - 17 - index);
  }, []);
  const selectedCourse = courses.find((course) => course.code === form.course);
  // The backend sends sections already ordered by year level, then section.
  const availableYears = [...new Set(selectedCourse?.sections.map((entry) => entry.year) || [])];
  const availableSections = selectedCourse?.sections.filter((entry) => entry.year === form.year).map((entry) => entry.section) || [];
  const dayCount = form.dobYear && form.dobMonth
    ? new Date(+form.dobYear, +form.dobMonth, 0).getDate() : 31;

  // Student ID field: once the ID is complete, it is looked up on the school masterlist
  // (when the clinic turned that check on). The icon spins while it checks, then shows a check or an X.
  useEffect(() => {
    const id = form.student_id;
    if (!STUDENT_ID_PATTERN.test(id) || !isValidStudentIdYear(id.slice(0, 4))) {
      setIdCheck({ status: 'idle', id: '' });
      return undefined;
    }
    if (!masterlistRequired) {
      setIdCheck({ status: 'format', id });
      return undefined;
    }
    const controller = new AbortController();
    setIdCheck({ status: 'checking', id });
    const timer = window.setTimeout(async () => {
      const started = Date.now();
      let status = 'error';
      try {
        const result = await authService.checkStudentId(id, controller.signal);
        status = result === 'unchecked' ? 'format' : result;
      } catch (error) {
        if (controller.signal.aborted) return;
        status = error.response?.status === 429 ? 'busy' : 'error';
      }
      // Keep the spinner up a moment so the check is seen.
      const wait = Math.max(0, 700 - (Date.now() - started));
      window.setTimeout(() => { if (!controller.signal.aborted) setIdCheck({ status, id }); }, wait);
    }, 350);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [form.student_id, masterlistRequired]);

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setInterval(() => setCooldown((time) => Math.max(0, time - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown > 0]);
  useEffect(() => {
    if (!legalModal) return undefined;
    const escape = (event) => { if (event.key === 'Escape') setLegalModal(null); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [legalModal]);

  const change = (event) => {
    const { name, value, type, checked } = event.target;
    let next = type === 'checkbox' ? checked : value;
    if (name === 'section' && value && !availableSections.includes(value)) return;
    if (['first_name', 'middle_name', 'last_name'].includes(name)) {
      next = formatPersonName(value.replace(/[^\p{L}\s\-'.]/gu, ''));
    }
    let typingNote = '';
    if (name === 'student_id') {
      next = formatStudentId(value);
      typingNote = studentIdTypingNote(value, next);
    }
    setForm((previous) => {
      const updated = { ...previous, [name]: next };
      if (name === 'course') {
        const course = courses.find((entry) => entry.code === next);
        if (!course?.sections.some((entry) => entry.year === previous.year)) updated.year = '';
        updated.section = '';
      }
      if (name === 'year') updated.section = '';
      if (['dobMonth', 'dobYear'].includes(name) && updated.dobYear && updated.dobMonth && updated.dobDay) {
        if (+updated.dobDay > new Date(+updated.dobYear, +updated.dobMonth, 0).getDate()) {
          updated.dobDay = '';
        }
      }
      return updated;
    });
    setErrors((previous) => ({
      ...previous,
      [name]: typingNote,
      ...(['course', 'year'].includes(name) ? { section: '' } : {}),
      ...(name === 'course' ? { year: '' } : {}),
      ...(name === 'password' ? { password_confirmation: '' } : {}),
      ...(name.startsWith('dob') ? { birthday: '' } : {}),
    }));
    setMessage('');
  };

  const validate = () => {
    const next = {};
    const validName = /^[\p{L}\s\-'.]+$/u;
    if (!STUDENT_ID_PATTERN.test(form.student_id)) next.student_id = 'Use the format 2023-00000-BN-0.';
    else if (!isValidStudentIdYear(form.student_id.slice(0, 4))) next.student_id = `The year must be from 2000 to ${new Date().getFullYear()}.`;
    else if (idCheck.status === 'not_found' && idCheck.id === form.student_id) next.student_id = ID_NOT_FOUND;
    else if (idCheck.status === 'registered' && idCheck.id === form.student_id) next.student_id = ID_REGISTERED;
    const firstError = firstNameError(form.first_name);
    if (firstError) next.first_name = firstError;
    const lastError = lastNameError(form.last_name);
    if (lastError) next.last_name = lastError;
    if (form.middle_name && (!validName.test(form.middle_name) || form.middle_name.length > 100)) {
      next.middle_name = 'Enter a valid middle name.';
    }
    if (!['male', 'female'].includes(form.gender)) next.gender = 'Select your gender.';
    if (!form.dobMonth || !form.dobDay || !form.dobYear) next.birthday = 'Birthday is required.';
    else if (!isValidBirthday(form.dobYear, form.dobMonth, form.dobDay)) next.birthday = 'Enter a valid birthday.';
    else {
      if (birthdayOf(form) > getMinimumBirthday()) next.birthday = 'You must be at least 17 years old to register.';
    }
    const mailError = emailError(form.email);
    if (mailError) next.email = mailError;
    if (contactPhoneError(form.mobile_number, true)) {
      next.mobile_number = 'Enter your mobile number as +639XXXXXXXXX.';
    }
    if (!selectedCourse) next.course = 'Select your course.';
    if (!availableYears.includes(form.year)) next.year = 'Select a valid year level for your course.';
    if (!availableSections.includes(form.section)) next.section = 'Select your section.';
    if (!PASSWORD_RULES.every(({ test }) => test(form.password))) next.password = 'Your password must meet everything in Password Strength.';
    if (!form.password_confirmation.trim()) next.password_confirmation = 'Confirm Password is required.';
    else if (form.password_confirmation !== form.password) next.password_confirmation = 'Passwords must match.';
    if (!form.agree_terms) next.agree_terms = 'Please agree to the Terms of Service and Privacy Policy.';
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      const element = document.getElementById(first === 'birthday' ? 'dobMonth' : first);
      element?.focus();
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return !first;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitRef.current || verified) return;
    if (otpStep) {
      if (!/^\d{6}$/.test(otp)) {
        setErrors((previous) => ({ ...previous, otp: 'Enter the six-digit verification code.' }));
        return;
      }
      submitRef.current = true;
      setLoading(true);
      setMessage('');
      try {
        const response = await authService.verifyRegistration(form.email.trim().toLowerCase(), otp);
        if (!response?.success) {
          setMessageType('error');
          setMessage('Verification was not accepted. Please try again.');
          return;
        }
        // The popup's button takes the student to sign in
        setVerified(true);
      } catch (error) {
        setMessageType('error');
        setMessage(apiMessage(error, 'The code is incorrect or expired. Please try again.'));
        if (error.response?.data?.errors?.otp) setErrors((previous) => ({ ...previous, otp: error.response.data.errors.otp }));
      } finally {
        submitRef.current = false;
        setLoading(false);
      }
      return;
    }

    if (!validate()) return;
    submitRef.current = true;
    setLoading(true);
    setMessage('');
    try {
      const payload = {
        student_id: form.student_id.trim().toUpperCase(),
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim() || null,
        last_name: form.last_name.trim(),
        birthday: birthdayOf(form),
        gender: form.gender,
        email: form.email.trim().toLowerCase(),
        mobile_number: form.mobile_number,
        course: form.course,
        year: form.year,
        section: form.section.trim(),
        password: form.password,
        password_confirmation: form.password_confirmation,
      };
      const response = await authService.register(payload);
      if (!response?.success) {
        setMessageType('error');
        setMessage(response?.message || 'Registration was not accepted. Please check your details.');
        return;
      }
      setOtpStep(true);
      setOtp('');
      setCooldown(60);
      setMessageType('success');
      setMessage(response.message || 'Enter your verification code or request a new code.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setMessageType('error');
      const validationErrors = error.response?.status === 422 ? error.response.data?.errors : null;
      const pending = Boolean(error.response?.data?.registration_pending);
      // Pending: the registration is saved but the email was not confirmed, so show
      // the server's note ("enter your code if received...") instead of "server unavailable".
      setMessage(validationErrors ? '' : pending ? (error.response.data.message || 'Your registration is pending. Enter your code if you received it.') : apiMessage(error, 'Unable to register. Please check your details.'));
      if (pending) {
        setOtpStep(true);
        setOtp('');
        setCooldown(60);
      }
      if (validationErrors) setErrors(validationErrors);
    } finally {
      submitRef.current = false;
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (!otpStep || cooldown || resending || resendRef.current || loading || verified) return;
    resendRef.current = true;
    setResending(true);
    setMessage('');
    try {
      const response = await authService.resendRegistrationOtp(form.email.trim().toLowerCase());
      if (!response?.success) {
        setMessageType('error');
        setMessage('Unable to resend the verification code. Please try again.');
        return;
      }
      setOtp('');
      setErrors((previous) => ({ ...previous, otp: '' }));
      setCooldown(60);
      setMessageType('success');
      setMessage('A new code was sent. It is valid for 10 minutes.');
    } catch (error) {
      setMessageType('error');
      setMessage(apiMessage(error, 'Unable to resend the verification code.'));
    } finally {
      resendRef.current = false;
      setResending(false);
    }
  };

  const textField = (name, label, placeholder, options = {}) => (
    <Field id={name} label={label} optional={options.optional} error={errors[name]}>
      <input
        id={name} name={name} type={options.type || 'text'} value={form[name]}
        onChange={change} placeholder={placeholder} autoComplete={options.autoComplete}
        maxLength={options.maxLength} inputMode={options.inputMode} disabled={loading}
        aria-invalid={Boolean(errors[name])}
        className={`${INPUT} ${errors[name] ? INVALID : ''}`}
      />
    </Field>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-[#f7f8fa] dark:bg-gray-900 lg:flex-row">
      {/* Same split layout as Login. Actual school + clinic photos merge via CSS.
          Image panel is intentionally hidden on phones, optional on tablets. */}
      <aside className="relative isolate hidden min-h-screen overflow-hidden bg-maroon-950 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-1/2 lg:shrink-0 xl:w-[55%]">
        {/* Upper campus photo */}
        <img
          src={campusPhoto}
          alt="PUP Biñan campus building"
          className="absolute inset-0 -z-30 h-full w-full object-cover object-[55%_center]"
        />
        {/* Clinic photo blended across the lower portion of the campus photo. */}
        <img
          src={clinicPhoto}
          alt="Students receiving services in the PUP Biñan clinic"
          className="absolute inset-x-0 bottom-0 -z-20 h-[53%] w-full object-cover object-center"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.18) 15%, black 58%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.18) 15%, black 58%)',
          }}
        />
        {/* Maroon overlays unify both real photographs without dotted patterns. */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-maroon-950/95 via-maroon-800/73 to-maroon-950/33" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-maroon-950/80 via-transparent to-maroon-950/25" />

        <div className="flex h-full w-full flex-col justify-between gap-6 px-7 py-8 xl:px-12 xl:py-10">
          <Link to="/" className="inline-flex items-center gap-3 self-start">
            <img
              src={clinicLogo}
              alt="PUPBC CareLink clinic logo"
              className="h-12 w-12 rounded-full border border-white/30 bg-white object-cover shadow-lg"
            />
            <span>
              <span className="block text-xl font-extrabold tracking-tight">PUPBC CareLink</span>
              <span className="block text-xs text-rose-100">Student Health Portal · PUP Biñan Campus</span>
            </span>
          </Link>

          <div className="max-w-[430px]">
            <h1 className="font-serif text-4xl font-bold leading-[1.1] xl:text-5xl">
              A Healthier<br />Tomorrow<br />Starts Here.
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/95 xl:text-base">
              Your campus care, one account away. Create a secure account to book clinic visits,
              use QR check-in and view your available health records.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-[10px] border border-white/25 bg-maroon-800/65 px-3 py-2 backdrop-blur-sm">Secure email verification</span>
              <span className="rounded-[10px] border border-white/25 bg-maroon-800/65 px-3 py-2 backdrop-blur-sm">Made for PUP Biñan students</span>
            </div>
          </div>

          <div className="flex items-end justify-between gap-3 text-white/90">
            <p className="font-serif text-lg italic leading-6">Same PUP spirit.<br />A healthier you.</p>
            <p className="text-right text-xs leading-5 text-white/75">Polytechnic University of the Philippines<br />Biñan Campus</p>
          </div>
        </div>
      </aside>

      {/* Small-screen header instead of the large decorative photo panel. */}
      <div className="bg-maroon-950 px-5 py-4 text-white lg:hidden">
        <Link to="/" className="inline-flex items-center gap-3">
          <img src={clinicLogo} alt="PUPBC CareLink" className="h-11 w-11 rounded-full border border-white/30 bg-white object-cover" />
          <span><span className="block text-base font-extrabold">PUPBC CareLink</span>
          <span className="block text-xs text-rose-100">PUP Biñan Campus · Student Health Portal</span></span>
        </Link>
      </div>

      <main className="flex min-w-0 flex-1 justify-center bg-[#f8f4f3] dark:bg-gray-900 px-4 py-7 sm:px-6 lg:px-7 lg:py-10">
        <div className="w-full max-w-md">
          {/* Header: clinic logo, then the centered title and short line. Back to sign in is the "Log in" link under the form. */}
          <div className="mb-5 text-center">
            <h2 className="text-2xl font-black text-slate-950">{otpStep ? 'Verify your email' : 'Create your account'}</h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-500">{otpStep ? 'One last step before you can sign in.' : 'Fill in your details to get started.'}</p>
          </div>

          <StudentToast message={message} type={messageType} onClose={() => setMessage('')} />
          <StudentNoticeModal
            open={verified}
            type="success"
            title="Account created"
            message="Your CareLink account is ready. You can now sign in with your Student ID, birthday and password."
            actionLabel="Go to sign in"
            onClose={() => navigate('/login', { replace: true })}
          />

          <form onSubmit={handleSubmit} noValidate autoComplete="off" className="rounded-[10px] border border-slate-200 bg-white p-4 shadow-[0_14px_50px_rgba(25,32,51,0.07)] sm:p-6">
            {!otpStep ? (
              <div className="space-y-5">
                <section>
                  <SectionTitle icon={UserRound}>Personal Information</SectionTitle>
                  <div className="space-y-3">
                    <StudentIdField value={form.student_id} onChange={change} disabled={loading} error={errors.student_id} check={idCheck} required={masterlistRequired} />
                    {/* Two columns: First name | Middle name, then Last name | Gender (one column on very small phones). */}
                    <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
                      <CheckedField id="first_name" label="First name" value={form.first_name} onChange={change} check={firstNameError} disabled={loading} error={errors.first_name} placeholder="Juan" autoComplete="off" maxLength={100} />
                      {textField('middle_name', 'Middle name', 'Optional', { optional: true, autoComplete: 'off', maxLength: 100 })}
                      <CheckedField id="last_name" label="Last name" value={form.last_name} onChange={change} check={lastNameError} disabled={loading} error={errors.last_name} placeholder="Dela Cruz" autoComplete="off" maxLength={100} />
                      <Field id="gender" label="Gender" error={errors.gender}>
                        <span className="relative block min-w-0">
                          <select id="gender" name="gender" value={form.gender} onChange={change} disabled={loading} className={`${INPUT} peer cursor-pointer appearance-none pr-10 ${errors.gender ? INVALID : ''}`}>
                            <option value="">Select gender</option>
                            <option value="male">Male</option><option value="female">Female</option>
                          </select>
                          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 peer-disabled:opacity-50 dark:text-slate-500" />
                        </span>
                      </Field>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-slate-700">Birthday</p>
                      <div className="grid grid-cols-[1.3fr_0.8fr_1fr] gap-2">
                        <span className="relative block min-w-0">
                          <select id="dobMonth" name="dobMonth" aria-label="Birth month" value={form.dobMonth} onChange={change} disabled={loading} className={`${INPUT} peer cursor-pointer appearance-none pl-2 pr-7 text-xs sm:text-sm ${errors.birthday ? INVALID : ''}`}>
                            <option value="">Month</option>
                            {MONTHS.map((month, index) => <option key={month} value={String(index + 1).padStart(2, '0')}>{month}</option>)}
                          </select>
                          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 peer-disabled:opacity-50 dark:text-slate-500" />
                        </span>
                        <span className="relative block min-w-0">
                          <select id="dobDay" name="dobDay" aria-label="Birth day" value={form.dobDay} onChange={change} disabled={loading} className={`${INPUT} peer cursor-pointer appearance-none pl-2 pr-7 text-xs sm:text-sm ${errors.birthday ? INVALID : ''}`}>
                            <option value="">Day</option>
                            {Array.from({ length: dayCount }, (_, i) => String(i + 1).padStart(2, '0')).map((day) => <option key={day} value={day}>{+day}</option>)}
                          </select>
                          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 peer-disabled:opacity-50 dark:text-slate-500" />
                        </span>
                        <span className="relative block min-w-0">
                          <select id="dobYear" name="dobYear" aria-label="Birth year" value={form.dobYear} onChange={change} disabled={loading} className={`${INPUT} peer cursor-pointer appearance-none pl-2 pr-7 text-xs sm:text-sm ${errors.birthday ? INVALID : ''}`}>
                            <option value="">Year</option>
                            {years.map((year) => <option key={year} value={year}>{year}</option>)}
                          </select>
                          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 peer-disabled:opacity-50 dark:text-slate-500" />
                        </span>
                      </div>
                      {errors.birthday && <p role="alert" className="mt-1 text-xs text-red-600">{errors.birthday}</p>}
                    </div>
                  </div>
                </section>

                <section>
                  <SectionTitle icon={Mail}>Contact Information</SectionTitle>
                  <div className="space-y-3">
                    <CheckedField id="email" label="Email address" type="email" icon={Mail} value={form.email} onChange={change} check={emailError} disabled={loading} error={errors.email} placeholder="name@example.com" autoComplete="off" inputMode="email" maxLength={255} />
                    <Field id="mobile_number" label="Mobile number" error={errors.mobile_number}>
                      <div className="relative">
                        <PhilippineMobileInput id="mobile_number" name="mobile_number" value={form.mobile_number} onChange={change} disabled={loading} autoComplete="off" aria-invalid={Boolean(errors.mobile_number)} className={`${INPUT} ${errors.mobile_number ? INVALID : ''}`} />
                      </div>
                    </Field>
                  </div>
                </section>

                <section>
                  <SectionTitle icon={GraduationCap}>Academic Information</SectionTitle>
                  <div className="space-y-3">
                    <Field id="course" label="Course" error={errors.course}>
                      <span className="relative block min-w-0">
                        <select id="course" name="course" value={form.course} onChange={change} disabled={loading || catalogStatus !== 'ready'} aria-invalid={Boolean(errors.course)} className={`${INPUT} peer cursor-pointer appearance-none pr-10 ${errors.course ? INVALID : ''}`}>
                          <option value="">{catalogStatus === 'loading' ? 'Loading courses…' : 'Select your course'}</option>
                          {courses.map((course) => <option key={course.code} value={course.code}>{course.code} ({course.name})</option>)}
                        </select>
                        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 peer-disabled:opacity-50 dark:text-slate-500" />
                      </span>
                      {catalogStatus === 'error' && (
                        <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                          Courses could not be loaded.{' '}
                          <button type="button" onClick={loadCatalog} className="font-semibold underline">Try again</button>
                        </p>
                      )}
                      {catalogStatus === 'empty' && (
                        <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                          Registration is not open yet. Please contact the clinic.
                        </p>
                      )}
                    </Field>
                    {/* Year level | Section side by side; Course stays full width above. */}
                    <div className="grid grid-cols-2 gap-3">
                      <Field id="year" label="Year level" error={errors.year}>
                        <span className="relative block min-w-0">
                          <select id="year" name="year" value={form.year} onChange={change} disabled={loading || !form.course} aria-invalid={Boolean(errors.year)} className={`${INPUT} peer cursor-pointer appearance-none pr-10 ${errors.year ? INVALID : ''}`}>
                            <option value="">Select year</option>
                            {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
                          </select>
                          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 peer-disabled:opacity-50 dark:text-slate-500" />
                        </span>
                      </Field>
                      <Field id="section" label="Section" error={errors.section}>
                        <span className="relative block min-w-0">
                          <select id="section" name="section" value={form.section} onChange={change} disabled={loading || !form.course || !form.year} aria-invalid={Boolean(errors.section)} className={`${INPUT} peer cursor-pointer appearance-none pr-10 ${errors.section ? INVALID : ''}`}>
                            <option value="">Select section</option>
                            {availableSections.map((section) => <option key={section} value={section}>{section}</option>)}
                          </select>
                          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 peer-disabled:opacity-50 dark:text-slate-500" />
                        </span>
                      </Field>
                    </div>
                  </div>
                </section>

                <section>
                  <SectionTitle icon={LockKeyhole}>Account Security</SectionTitle>
                  <div className="space-y-3">
                    <Field id="password" label="Password" error={errors.password}>
                      <div className="relative">
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          value={form.password}
                          onChange={change}
                          disabled={loading}
                          placeholder="Password"
                          autoComplete="off"
                          className={`${INPUT} pr-11 ${errors.password ? INVALID : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-2 top-1.5 flex h-8 w-8 items-center justify-center rounded-[10px] text-slate-500 hover:bg-slate-100"
                        >
                          {showPassword ? <Eye size={17} /> : <EyeOff size={17} />}
                        </button>
                      </div>
                    </Field>

                    {/* Password Strength: always shown. Each circle turns into a green check once that rule is met. */}
                    <div className="rounded-[10px] border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-800/60" aria-live="polite">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Password Strength</p>
                      <ul className="mt-1.5 space-y-1.5">
                        {PASSWORD_RULES.map(({ label, test }) => {
                          const met = test(form.password);
                          const Icon = met ? CheckCircle2 : Circle;
                          return (
                            <li key={label} className={`flex items-center gap-2 text-xs transition-colors ${met ? 'text-green-700 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                              <Icon size={16} className={`shrink-0 ${met ? 'text-green-600 dark:text-green-400' : 'text-slate-300 dark:text-slate-500'}`} aria-hidden="true" />
                              <span>{label}</span>
                              <span className="sr-only">{met ? '(done)' : '(not yet)'}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <Field id="password_confirmation" label="Confirm password" error={errors.password_confirmation}>
                      <div className="relative">
                        <input
                          id="password_confirmation"
                          name="password_confirmation"
                          type={showConfirm ? 'text' : 'password'}
                          value={form.password_confirmation}
                          onChange={change}
                          disabled={loading}
                          placeholder="Confirm password"
                          autoComplete="off"
                          className={`${INPUT} pr-11 ${errors.password_confirmation ? INVALID : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm((value) => !value)}
                          aria-label={showConfirm ? 'Hide password' : 'Show password'}
                          className="absolute right-2 top-1.5 flex h-8 w-8 items-center justify-center rounded-[10px] text-slate-500 hover:bg-slate-100"
                        >
                          {showConfirm ? <Eye size={17} /> : <EyeOff size={17} />}
                        </button>
                      </div>
                    </Field>

                    {/* Live match result directly underneath Confirm Password */}
                    {form.password_confirmation && (!errors.password_confirmation || form.password_confirmation === form.password) && (
                      <p
                        className={`flex items-center gap-1.5 text-xs font-semibold ${form.password_confirmation === form.password ? 'text-green-700' : 'text-red-600'}`}
                        role="status"
                        aria-live="polite"
                      >
                        {form.password_confirmation === form.password ? (
                          <><CheckCircle2 size={15} /> Passwords match</>
                        ) : (
                          <><X size={15} /> Passwords do not match</>
                        )}
                      </p>
                    )}
                    <div className="rounded-[10px] border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start gap-3">
                        <input id="agree_terms" name="agree_terms" type="checkbox" checked={form.agree_terms} onChange={change} disabled={loading} className="mt-1 h-4 w-4 shrink-0 accent-maroon-800" />
                        <div className="text-xs leading-6 text-slate-600">
                          <label htmlFor="agree_terms">I agree to the </label>
                          <button type="button" onClick={() => setLegalModal('terms')} className="font-bold text-maroon-800 dark:text-rose-300 hover:underline">Terms of Service</button>
                          {' and '}
                          <button type="button" onClick={() => setLegalModal('privacy')} className="font-bold text-maroon-800 dark:text-rose-300 hover:underline">Privacy Policy</button>.
                        </div>
                      </div>
                      {errors.agree_terms && <p role="alert" className="mt-2 text-xs text-red-600">{errors.agree_terms}</p>}
                    </div>
                  </div>
                </section>
              </div>
            ) : (
              <div className="py-4 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[10px] bg-maroon-800 text-white dark:bg-maroon-700"><Mail size={27} /></span>
                <h3 className="mt-4 text-xl font-bold">Check your inbox</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">Enter the six-digit code sent to <strong className="break-all text-slate-900">{form.email}</strong>. It expires in 10 minutes.</p>
                <div className="mx-auto mt-5 max-w-[250px] text-left">
                  <Field id="otp" label="Verification code" error={errors.otp}>
                    <input id="otp" name="otp" type="text" inputMode="numeric" autoComplete="off" maxLength={6} value={otp} onChange={(event) => { setOtp(event.target.value.replace(/\D/g, '').slice(0, 6)); setErrors((previous) => ({ ...previous, otp: '' })); }} disabled={loading || verified} placeholder="000000" className={`${INPUT} text-center text-xl font-black tracking-[0.3em] ${errors.otp ? INVALID : ''}`} />
                  </Field>
                </div>
                <div className="mt-4 text-xs text-slate-500">
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : (
                    <button type="button" onClick={resendOtp} disabled={resending || loading || verified} className="inline-flex items-center gap-1.5 font-bold text-maroon-800 dark:text-rose-300 hover:underline disabled:opacity-50">{resending ? <Loader2 size={15} className="animate-spin" /> : null}{resending ? 'Resending...' : 'Resend verification code'}</button>
                  )}
                </div>
              </div>
            )}
            <button type="submit" disabled={loading || resending || verified} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-maroon-800 px-4 py-3 text-sm font-bold text-white transition-colors hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? <><Loader2 size={17} className="animate-spin" />{otpStep ? 'Verifying...' : 'Sending code...'}</> : otpStep ? 'Verify & Create Account' : 'Continue to Email Verification'}
            </button>
            <p className="mt-4 text-center text-sm text-slate-500">Already have an account? <Link to="/login" className="font-bold text-maroon-800 dark:text-rose-300 hover:underline">Log in</Link></p>
          </form>
          <p className="mt-5 text-center text-xs text-slate-400">PUPBC CareLink · Student Health Portal</p>
        </div>
      </main>

      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setLegalModal(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="legal-title" className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-[10px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 id="legal-title" className="flex items-center gap-2 text-base font-extrabold text-slate-900"><FileText size={19} className="text-maroon-800 dark:text-rose-300" />{legalModal === 'terms' ? 'Terms of Service' : 'Privacy Policy'}</h2>
              <button type="button" onClick={() => setLegalModal(null)} aria-label="Close" className="rounded-[10px] p-2 text-slate-500 hover:bg-slate-100"><X size={19} /></button>
            </div>
            <div className="space-y-4 overflow-y-auto p-5 text-sm leading-6 text-slate-600">
              {legalModal === 'terms' ? (
                <>
                  <p><strong>Account Use.</strong> Your CareLink account is intended for your own student clinic transactions and health-service access.</p>
                  <p><strong>Accurate Information.</strong> Submitted identity, academic and contact details should match your current university records.</p>
                  <p><strong>Account Security.</strong> Keep your credentials private and do not allow anyone else to use your account.</p>
                  <p><strong>Clinic Services.</strong> Appointment bookings, QR check-in, queueing and health records are subject to clinic procedures and availability.</p>
                </>
              ) : (
                <>
                  <p><strong>Information Collected.</strong> CareLink may process identity, contact details, academic information, appointments and clinic-related health records to provide campus health services.</p>
                  <p><strong>Purpose.</strong> Information is used for account verification, appointments, check-in, queue management, notifications and authorized clinic documentation.</p>
                  <p><strong>Access.</strong> Records should be accessible only to you and authorized clinic personnel according to system permissions.</p>
                  <p><strong>Accuracy.</strong> Keep your information updated where permitted by the system.</p>
                </>
              )}
            </div>
            <div className="border-t border-slate-200 p-4"><button type="button" onClick={() => setLegalModal(null)} className="w-full rounded-[10px] bg-maroon-800 py-2.5 text-sm font-bold text-white transition-colors hover:text-white/70">Close</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
