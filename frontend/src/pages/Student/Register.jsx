import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, FileText,
  GraduationCap, Loader2, LockKeyhole, Mail, Phone,
  RefreshCw, ShieldCheck, UserRound, X,
} from 'lucide-react';
import authService from '../../services/authService';
import clinicLogo from '../../assets/clinic logo.jpg';
import campusPhoto from '../../assets/pup-binan-hero.jpg';
import clinicPhoto from '../../assets/clinic-waiting-area.jpg';

// The keys below are the existing database/API course codes.
// The descriptions appear in the dropdown; they are not sent to the API.
const COURSES = [
  ['BSIT', 'Bachelor of Science in Information Technology'],
  ['BSCPE', 'Bachelor of Science in Computer Engineering'],
  ['BSIE', 'Bachelor of Science in Industrial Engineering'],
  ['BSBA-HRM', 'Bachelor of Science in Business Administration, major in Human Resource Management'],
  ['BSED-SS', 'Bachelor of Secondary Education, major in Social Studies'],
  ['BSED-English', 'Bachelor of Secondary Education, major in English'],
  ['BEED', 'Bachelor of Elementary Education'],
  ['BSPSYCH', 'Bachelor of Science in Psychology'],
  ['DIT', 'Diploma in Information Technology'],
  ['DCET', 'Diploma in Computer Engineering Technology'],
];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
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
const INPUT = 'min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#741126] focus:ring-2 focus:ring-[#741126]/15 disabled:cursor-not-allowed disabled:opacity-60';
const INVALID = 'border-red-400 focus:border-red-500 focus:ring-red-500/15';

function getManilaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (name) => parts.find((item) => item.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
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
  const clean = String(value).toUpperCase().replace(/[^0-9BN]/g, '').slice(0, 12);
  if (clean.length <= 4) return clean;
  if (clean.length <= 9) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  if (clean.length <= 11) return `${clean.slice(0, 4)}-${clean.slice(4, 9)}-${clean.slice(9)}`;
  return `${clean.slice(0, 4)}-${clean.slice(4, 9)}-${clean.slice(9, 11)}-${clean.slice(11)}`;
}
// Only Philippine mobile prefixes can be entered. Accept both 09... and +639...
// A typed 639... is displayed as +639... automatically.
function formatPhilippineMobile(raw) {
  const value = String(raw).replace(/[\s()-]/g, '');
  const prefixed = value.startsWith('63') ? `+${value}` : value;
  const validPartial = /^(?:|0|09\d{0,9}|\+|\+6|\+63|\+639\d{0,9})$/;
  return validPartial.test(prefixed) ? prefixed : null;
}

function getPasswordStrength(password) {
  if (!password) return null;
  const lengthOk = password.length >= 8;
  const number = /\d/.test(password);
  const special = /[^A-Za-z0-9]/.test(password);
  const mixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  if (!lengthOk || !(number || special)) {
    return { label: 'Weak', color: 'bg-red-500', text: 'text-red-600', segments: 1 };
  }
  if (!(number && special)) {
    return { label: 'Moderate', color: 'bg-yellow-400', text: 'text-yellow-700', segments: 2 };
  }
  if (password.length >= 12 && mixedCase) {
    return { label: 'Strong', color: 'bg-green-500', text: 'text-green-700', segments: 4 };
  }
  return { label: 'Good', color: 'bg-blue-500', text: 'text-blue-700', segments: 3 };
}

function normalizePhone(phone) {
  return /^09\d{9}$/.test(phone) ? `+63${phone.slice(1)}` : phone;
}
function apiMessage(error, fallback) {
  const status = error?.response?.status;
  if (status === 429) return 'Too many requests. Please wait and try again.';
  if (status >= 500) return 'The server is temporarily unavailable. Please try again later.';
  if (!error?.response) return 'Cannot connect to CareLink. Check your connection and backend server.';
  return error.response.data?.message || fallback;
}
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
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f9e9ee] text-[#741126]">
        <Icon size={17} />
      </span>
      <h3 className="text-sm font-extrabold text-slate-900">{children}</h3>
    </div>
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

  const years = useMemo(() => {
    const current = Number(getManilaDate().slice(0, 4));
    return Array.from({ length: 80 }, (_, index) => current - index);
  }, []);
  const passwordStrength = getPasswordStrength(form.password);
  const dayCount = form.dobYear && form.dobMonth
    ? new Date(+form.dobYear, +form.dobMonth, 0).getDate() : 31;

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
    if (['first_name', 'middle_name', 'last_name'].includes(name)) {
      next = value.replace(/[^\p{L}\s\-'.]/gu, '');
    }
    if (name === 'student_id') next = formatStudentId(value);
    if (name === 'mobile_number') {
      const formatted = formatPhilippineMobile(value);
      if (formatted === null) return; // Reject non-PH prefixes and extra digits as typed.
      next = formatted;
    }
    if (name === 'section') next = value.toUpperCase().replace(/[^A-Z0-9\s\-]/g, '').slice(0, 30);
    setForm((previous) => {
      const updated = { ...previous, [name]: next };
      if (['dobMonth', 'dobYear'].includes(name) && updated.dobYear && updated.dobMonth && updated.dobDay) {
        if (+updated.dobDay > new Date(+updated.dobYear, +updated.dobMonth, 0).getDate()) {
          updated.dobDay = '';
        }
      }
      return updated;
    });
    setErrors((previous) => ({ ...previous, [name]: '', ...(name.startsWith('dob') ? { birthday: '' } : {}) }));
    setMessage('');
  };

  const validate = () => {
    const next = {};
    const validName = /^[\p{L}\s\-'.]+$/u;
    for (const name of ['first_name', 'last_name']) {
      if (!form[name].trim()) next[name] = 'This field is required.';
      else if (!validName.test(form[name].trim()) || form[name].length > 100) next[name] = 'Enter a valid name.';
    }
    if (form.middle_name && (!validName.test(form.middle_name) || form.middle_name.length > 100)) {
      next.middle_name = 'Enter a valid middle name.';
    }
    if (!/^\d{4}-\d{5}-BN-[01]$/.test(form.student_id)) next.student_id = 'Use the format 2023-00000-BN-0.';
    if (!form.dobMonth || !form.dobDay || !form.dobYear) next.birthday = 'Birthday is required.';
    else if (!isValidBirthday(form.dobYear, form.dobMonth, form.dobDay)) next.birthday = 'Enter a valid birthday.';
    else if (birthdayOf(form) > getManilaDate()) next.birthday = 'Birthday cannot be in the future.';
    if (!['male', 'female', 'other'].includes(form.gender)) next.gender = 'Select your gender.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (!/^09\d{9}$/.test(form.mobile_number) && !/^\+639\d{9}$/.test(form.mobile_number)) {
      next.mobile_number = 'Use 09XXXXXXXXX or +639XXXXXXXXX.';
    }
    if (!COURSES.some(([code]) => code === form.course)) next.course = 'Select your course.';
    if (!YEARS.includes(form.year)) next.year = 'Select your year level.';
    if (!/^[A-Z0-9][A-Z0-9\s\-]{0,29}$/.test(form.section.trim())) next.section = 'Enter your section (e.g. 1-2).';
    if (form.password.length < 8) next.password = 'Password must have at least 8 characters.';
    else if (!/[\d\W_]/.test(form.password)) next.password = 'Include at least one number or special character.';
    if (!form.password_confirmation || form.password_confirmation !== form.password) next.password_confirmation = 'Passwords must match.';
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
        setVerified(true);
        setMessageType('success');
        setMessage('Account created successfully. You can now sign in.');
        navigate('/login', { replace: true });
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
        mobile_number: normalizePhone(form.mobile_number),
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
      setMessage(apiMessage(error, 'Unable to register. Please check your details.'));
      if (error.response?.data?.registration_pending) {
        setOtpStep(true);
        setOtp('');
        setCooldown(60);
      }
      if (error.response?.status === 422 && error.response.data?.errors) setErrors(error.response.data.errors);
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
    <div className="flex min-h-dvh flex-col bg-[#f7f8fa] lg:flex-row">
      {/* Same split layout as Login. Actual school + clinic photos merge via CSS.
          Image panel is intentionally hidden on phones, optional on tablets. */}
      <aside className="relative isolate hidden min-h-screen overflow-hidden bg-[#4d0d1b] text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-1/2 lg:shrink-0 xl:w-[55%]">
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
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#4d0d1b]/95 via-[#741126]/73 to-[#4d0d1b]/33" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#4d0d1b]/80 via-transparent to-[#4d0d1b]/25" />

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
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-100">Student registration</p>
            <h1 className="mt-4 font-serif text-4xl font-bold leading-[1.1] drop-shadow-md xl:text-5xl">
              A Healthier<br />Tomorrow<br />Starts Here.
            </h1>
            <div className="mt-5 h-1 w-14 rounded-full bg-rose-200" />
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/95 xl:text-base">
              Your campus care, one account away. Create a secure account to book clinic visits,
              use QR check-in and view your available health records.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-xl border border-white/25 bg-[#741126]/65 px-3 py-2 backdrop-blur-sm">Secure email verification</span>
              <span className="rounded-xl border border-white/25 bg-[#741126]/65 px-3 py-2 backdrop-blur-sm">Made for PUP Biñan students</span>
            </div>
          </div>

          <div className="flex items-end justify-between gap-3 text-white/90">
            <p className="font-serif text-lg italic leading-6">Same PUP spirit.<br />A healthier you.</p>
            <p className="text-right text-[11px] leading-5 text-white/75">Polytechnic University of the Philippines<br />Biñan Campus</p>
          </div>
        </div>
      </aside>

      {/* Small-screen header instead of the large decorative photo panel. */}
      <div className="bg-[#4d0d1b] px-5 py-4 text-white lg:hidden">
        <Link to="/" className="inline-flex items-center gap-3">
          <img src={clinicLogo} alt="PUPBC CareLink" className="h-11 w-11 rounded-full border border-white/30 bg-white object-cover" />
          <span><span className="block text-base font-extrabold">PUPBC CareLink</span>
          <span className="block text-xs text-rose-100">PUP Biñan Campus · Student Health Portal</span></span>
        </Link>
      </div>

      <main className="flex min-w-0 flex-1 justify-center bg-[#f8f4f3] px-4 py-7 sm:px-6 lg:px-7 lg:py-10">
        <div className="w-full max-w-md">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#741126]">Student registration</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">{otpStep ? 'Verify your email' : 'Create your account'}</h2>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">{otpStep ? 'One last step before you can sign in.' : 'Fill in your details to get started.'}</p>
            </div>
            <Link to="/login" aria-label="Back to login" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#741126] hover:bg-[#f9e9ee]"><ArrowLeft size={18} /></Link>
          </div>

          {message && (
            <div role="alert" className={`mb-4 rounded-xl border px-4 py-3 text-sm leading-6 ${messageType === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate autoComplete="on" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_14px_50px_rgba(25,32,51,0.07)] sm:p-6">
            {!otpStep ? (
              <div className="space-y-5">
                <section>
                  <SectionTitle icon={UserRound}>Personal Information</SectionTitle>
                  <div className="space-y-3">
                    {textField('first_name', 'First name', 'Juan', { autoComplete: 'given-name', maxLength: 100 })}
                    {textField('middle_name', 'Middle name', 'Optional', { optional: true, autoComplete: 'additional-name', maxLength: 100 })}
                    {textField('last_name', 'Last name', 'Dela Cruz', { autoComplete: 'family-name', maxLength: 100 })}
                    {textField('student_id', 'Student ID', '2023-00000-BN-0', { autoComplete: 'username', maxLength: 17 })}
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-slate-700">Birthday</p>
                      <div className="grid grid-cols-[1.3fr_0.8fr_1fr] gap-2">
                        <select id="dobMonth" name="dobMonth" aria-label="Birth month" value={form.dobMonth} onChange={change} disabled={loading} className={`${INPUT} px-2 text-xs sm:text-sm ${errors.birthday ? INVALID : ''}`}>
                          <option value="">Month</option>
                          {MONTHS.map((month, index) => <option key={month} value={String(index + 1).padStart(2, '0')}>{month}</option>)}
                        </select>
                        <select id="dobDay" name="dobDay" aria-label="Birth day" value={form.dobDay} onChange={change} disabled={loading} className={`${INPUT} px-2 text-xs sm:text-sm ${errors.birthday ? INVALID : ''}`}>
                          <option value="">Day</option>
                          {Array.from({ length: dayCount }, (_, i) => String(i + 1).padStart(2, '0')).map((day) => <option key={day} value={day}>{+day}</option>)}
                        </select>
                        <select id="dobYear" name="dobYear" aria-label="Birth year" value={form.dobYear} onChange={change} disabled={loading} className={`${INPUT} px-2 text-xs sm:text-sm ${errors.birthday ? INVALID : ''}`}>
                          <option value="">Year</option>
                          {years.map((year) => <option key={year} value={year}>{year}</option>)}
                        </select>
                      </div>
                      {errors.birthday && <p role="alert" className="mt-1 text-xs text-red-600">{errors.birthday}</p>}
                    </div>
                    <Field id="gender" label="Gender" error={errors.gender}>
                      <select id="gender" name="gender" value={form.gender} onChange={change} disabled={loading} className={`${INPUT} ${errors.gender ? INVALID : ''}`}>
                        <option value="">Select gender</option>
                        <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                      </select>
                    </Field>
                  </div>
                </section>

                <section>
                  <SectionTitle icon={Mail}>Contact Information</SectionTitle>
                  <div className="space-y-3">
                    <Field id="email" label="Email address" error={errors.email}>
                      <div className="relative">
                        <Mail size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
                        <input id="email" name="email" type="email" value={form.email} onChange={change} disabled={loading} placeholder="name@example.com" autoComplete="email" inputMode="email" maxLength={255} className={`${INPUT} pl-9 ${errors.email ? INVALID : ''}`} />
                      </div>
                    </Field>
                    <Field id="mobile_number" label="Mobile number" error={errors.mobile_number}>
                      <div className="relative">
                        <Phone size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
                        <input id="mobile_number" name="mobile_number" type="tel" value={form.mobile_number} onChange={change} disabled={loading} placeholder="09XXXXXXXXX or +639XXXXXXXXX" autoComplete="tel" inputMode="tel" maxLength={13} aria-describedby="mobile-help" className={`${INPUT} pl-9 ${errors.mobile_number ? INVALID : ''}`} />
                      </div>
                    </Field>
                  </div>
                </section>

                <section>
                  <SectionTitle icon={GraduationCap}>Academic Information</SectionTitle>
                  <div className="space-y-3">
                    <Field id="course" label="Course" error={errors.course}>
                      <select id="course" name="course" value={form.course} onChange={change} disabled={loading} className={`${INPUT} ${errors.course ? INVALID : ''}`}>
                        <option value="">Select your course</option>
                        {COURSES.map(([code, label]) => <option key={code} value={code}>{code} — {label}</option>)}
                      </select>
                    </Field>
                    <Field id="year" label="Year level" error={errors.year}>
                      <select id="year" name="year" value={form.year} onChange={change} disabled={loading} className={`${INPUT} ${errors.year ? INVALID : ''}`}>
                        <option value="">Select year level</option>
                        {YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
                      </select>
                    </Field>
                    <Field id="section" label="Section" error={errors.section}>
                      <input id="section" name="section" type="text" value={form.section} onChange={change} disabled={loading || !form.year} maxLength={30} placeholder={form.year ? 'Type your section, e.g. 1-2' : 'Select year level first'} autoComplete="off" className={`${INPUT} ${errors.section ? INVALID : ''}`} />
                    </Field>
                    <p className="text-xs leading-5 text-slate-500">Enter the section shown in your current class schedule. Sections are typed manually because they may change each school year.</p>
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
                          autoComplete="new-password"
                          className={`${INPUT} pr-11 ${errors.password ? INVALID : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-2 top-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                        >
                          {showPassword ? <Eye size={17} /> : <EyeOff size={17} />}
                        </button>
                      </div>
                    </Field>

                    {/* Show strength only after the student starts typing a password. */}
                    {form.password.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" aria-live="polite">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-600">Password strength</span>
                        <span className={`text-xs font-bold ${passwordStrength?.text || 'text-slate-400'}`}>
                          {passwordStrength?.label || 'Not entered'}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-1.5">
                        {[1, 2, 3, 4].map((level) => (
                          <span
                            key={level}
                            className={`h-1.5 flex-1 rounded-full ${passwordStrength && level <= passwordStrength.segments ? passwordStrength.color : 'bg-slate-200'}`}
                          />
                        ))}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        At least 8 characters and a number or special character. For a strong password, use 12+ characters, upper/lowercase letters, a number and a symbol.
                      </p>
                    </div>
                    )}

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
                          autoComplete="new-password"
                          className={`${INPUT} pr-11 ${errors.password_confirmation ? INVALID : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm((value) => !value)}
                          aria-label={showConfirm ? 'Hide password' : 'Show password'}
                          className="absolute right-2 top-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                        >
                          {showConfirm ? <Eye size={17} /> : <EyeOff size={17} />}
                        </button>
                      </div>
                    </Field>

                    {/* Live match result directly underneath Confirm Password */}
                    {form.password_confirmation && (
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
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start gap-3">
                        <input id="agree_terms" name="agree_terms" type="checkbox" checked={form.agree_terms} onChange={change} disabled={loading} className="mt-1 h-4 w-4 shrink-0 accent-[#741126]" />
                        <div className="text-xs leading-6 text-slate-600">
                          <label htmlFor="agree_terms">I agree to the </label>
                          <button type="button" onClick={() => setLegalModal('terms')} className="font-bold text-[#741126] hover:underline">Terms of Service</button>
                          {' and '}
                          <button type="button" onClick={() => setLegalModal('privacy')} className="font-bold text-[#741126] hover:underline">Privacy Policy</button>.
                        </div>
                      </div>
                      {errors.agree_terms && <p role="alert" className="mt-2 text-xs text-red-600">{errors.agree_terms}</p>}
                    </div>
                  </div>
                </section>
              </div>
            ) : (
              <div className="py-4 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f9e9ee] text-[#741126]"><Mail size={27} /></span>
                <h3 className="mt-4 text-xl font-bold">Check your inbox</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">Enter the six-digit code sent to <strong className="break-all text-slate-900">{form.email}</strong>. It expires in 10 minutes.</p>
                <div className="mx-auto mt-5 max-w-[250px] text-left">
                  <Field id="otp" label="Verification code" error={errors.otp}>
                    <input id="otp" name="otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => { setOtp(event.target.value.replace(/\D/g, '').slice(0, 6)); setErrors((previous) => ({ ...previous, otp: '' })); }} disabled={loading || verified} placeholder="000000" className={`${INPUT} text-center text-xl font-black tracking-[0.3em] ${errors.otp ? INVALID : ''}`} />
                  </Field>
                </div>
                <div className="mt-4 text-xs text-slate-500">
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : (
                    <button type="button" onClick={resendOtp} disabled={resending || loading || verified} className="inline-flex items-center gap-1.5 font-bold text-[#741126] hover:underline disabled:opacity-50">{resending ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}{resending ? 'Resending...' : 'Resend verification code'}</button>
                  )}
                </div>
              </div>
            )}
            <button type="submit" disabled={loading || resending || verified} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#741126] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#4d0d1b] disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? <><Loader2 size={17} className="animate-spin" />{otpStep ? 'Verifying...' : 'Sending code...'}</> : otpStep ? <><CheckCircle2 size={17} />Verify & Create Account</> : <>Continue to Email Verification <ArrowRight size={17} /></>}
            </button>
            <p className="mt-4 text-center text-sm text-slate-500">Already have an account? <Link to="/login" className="font-bold text-[#741126] hover:underline">Log in</Link></p>
          </form>
          <p className="mt-5 text-center text-xs text-slate-400">PUPBC CareLink · Student Health Portal</p>
        </div>
      </main>

      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setLegalModal(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="legal-title" className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 id="legal-title" className="flex items-center gap-2 text-base font-extrabold text-slate-900"><FileText size={19} className="text-[#741126]" />{legalModal === 'terms' ? 'Terms of Service' : 'Privacy Policy'}</h2>
              <button type="button" onClick={() => setLegalModal(null)} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={19} /></button>
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
            <div className="border-t border-slate-200 p-4"><button type="button" onClick={() => setLegalModal(null)} className="w-full rounded-xl bg-[#741126] py-2.5 text-sm font-bold text-white hover:bg-[#4d0d1b]">Close</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
