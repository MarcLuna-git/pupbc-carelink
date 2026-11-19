import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, Loader2, Lock, Mail, Stethoscope,
  CalendarCheck, QrCode, ShieldCheck, Hospital,
  Building2, GraduationCap, LockKeyhole, AlertCircle, CheckCircle2, Headset
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import authService from '../../../services/authService';
import clinicPhoto from '../../../assets/clinic-lab-test.jpg';

/*
 * Hero photo for the brand panel. Drop a `nurse-login-hero.(jpg|png|webp)`
 * into src/assets to use it; until then the clinic photo is shown.
 */
const heroOverride = Object.values(
  import.meta.glob('../../../assets/nurse-login-hero.{jpg,jpeg,png,webp}', { eager: true, import: 'default' })
)[0];
const heroPhoto = heroOverride || clinicPhoto;

const LogoTile = ({ className = '' }) => (
  <div className={`flex items-center justify-center rounded-[10px] bg-gradient-to-br from-red-600 via-maroon-700 to-maroon-900 shadow-lg shadow-maroon-900/40 ${className}`}>
    <Stethoscope className="h-1/2 w-1/2 text-yellow-400" strokeWidth={2.25} />
  </div>
);

const NurseLogin = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', remember: false });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const emailRef = useRef(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const closeMessage = () => {
    setMessage({ type: '', text: '' });
    emailRef.current?.focus();
  };

  // Esc closes an error popup (success just redirects on its own)
  useEffect(() => {
    if (message.type !== 'error') return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeMessage(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [message.type]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
    if (message.text) setMessage({ type: '', text: '' });
  };

  const handleKeyDown = (e) => {
    if (e.getModifierState('CapsLock')) {
      setCapsLockOn(true);
    } else {
      setCapsLockOn(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email.trim()) {
      setMessage({ type: 'error', title: 'Missing details', text: 'Please enter your email address.' });
      return;
    }
    if (!form.password.trim()) {
      setMessage({ type: 'error', title: 'Missing details', text: 'Please enter your password.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await authService.nurseLogin(form.email, form.password);
      if (res.success) {
        setMessage({ type: 'success', text: 'Login successful. Taking you to the nurse dashboard.' });
        setTimeout(() => navigate('/nurse/dashboard'), 1200);
      } else {
        setMessage({ type: 'error', text: res.message || 'Invalid credentials.' });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Unable to connect. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: CalendarCheck, label: 'Appointment Management' },
    { icon: QrCode, label: 'QR Check-in System' },
    { icon: ShieldCheck, label: 'Secure Student Records' },
    { icon: Hospital, label: 'Clinic Operations' },
  ];

  const inputClass =
    'w-full h-12 tall:h-14 rounded-[10px] border border-slate-200 bg-white pl-14 text-[15px] text-gray-800 outline-none transition-colors placeholder:text-gray-400 hover:border-maroon-300 focus:border-maroon-800';

  return (
    <div className="flex min-h-screen overflow-hidden bg-[#F7F7F8]">
      {/* ==================== Brand panel (lg and up) ==================== */}
      <div className="relative hidden overflow-hidden bg-maroon-900 lg:flex lg:w-1/2 xl:w-3/5">
        {/* Photo on the right half, fading into the maroon on the left */}
        <img
          src={heroPhoto}
          alt=""
          aria-hidden="true"
          className="absolute inset-y-0 right-0 h-full w-[62%] object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#660000_0%,#660000_36%,rgba(102,0,0,0.78)_58%,rgba(128,0,0,0.35)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-maroon-950/80 via-transparent to-maroon-950/30" />
        <div className="absolute inset-0 bg-red-700/20 mix-blend-multiply" />

        {/* Sweeping arc and faded cross */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 800 900"
          preserveAspectRatio="none"
        >
          <path d="M-40 900 C 260 640, 620 760, 860 560" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="70" />
          <path d="M-40 940 C 300 700, 640 820, 880 620" fill="none" stroke="rgba(185,28,28,0.35)" strokeWidth="40" />
        </svg>
        <svg aria-hidden="true" viewBox="0 0 100 100" className="pointer-events-none absolute -bottom-8 -left-8 h-44 w-44 rotate-[-18deg] text-red-500/25">
          <path fill="currentColor" d="M36 6h28v30h30v28H64v30H36V64H6V36h30z" />
        </svg>

        <div className="relative z-10 flex h-full w-full flex-col px-10 py-6 xl:px-14 roomy:py-8 tall:px-[92px] tall:py-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="flex items-center gap-4 tall:gap-5"
          >
            <LogoTile className="h-14 w-14 tall:h-[72px] tall:w-[72px]" />
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-white tall:text-[26px]">PUPBC CareLink</h1>
              <p className="text-base text-white/85 tall:text-lg">Clinic Management System</p>
            </div>
          </motion.div>

          {/* Main block, vertically centred so it lines up with the sign-in card */}
          <div className="my-auto py-4 roomy:py-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-2 text-[15px] text-white/90 roomy:space-y-3 tall:text-[17px]"
          >
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5" />
              <span>Polytechnic University of the Philippines</span>
            </div>
            <div className="flex items-center gap-3">
              <GraduationCap className="h-5 w-5" />
              <span>Biñan Campus</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-7 roomy:mt-16 tall:mt-10"
          >
            <h2 className="text-5xl font-extrabold leading-[1.05] tracking-tight text-white xl:text-6xl tall:text-[80px]">
              Nurse
              <br />
              <span className="text-yellow-400">Portal</span>
            </h2>
            <p className="mt-4 max-w-xl text-lg roomy:mt-5 leading-relaxed text-white/90 tall:mt-6 tall:text-xl">
              Manage clinic operations efficiently with a modern healthcare management platform.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="mt-6 grid max-w-[540px] roomy:mt-14 grid-cols-2 gap-2.5 tall:mt-10 tall:max-w-[620px] tall:gap-3"
          >
            {features.map((feature) => (
              <div
                key={feature.label}
                className="flex items-center gap-3 rounded-[10px] border border-white/15 bg-white/10 px-3 py-2.5 backdrop-blur-md roomy:py-3.5 tall:px-4 tall:py-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/15 tall:h-11 tall:w-11">
                  <feature.icon className="h-[18px] w-[18px] text-yellow-400 tall:h-5 tall:w-5" />
                </span>
                <span className="text-[13px] font-medium leading-snug text-white tall:text-[15px]">{feature.label}</span>
              </div>
            ))}
          </motion.div>
          </div>

          {/* Same height as the logo row above, so the main block sits at the true centre */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex h-14 items-end text-sm text-white/70 tall:h-[72px] tall:text-[15px]"
          >
            © {new Date().getFullYear()} PUPBC CareLink. All rights reserved.
          </motion.p>
        </div>
      </div>

      {/* ==================== Sign-in panel ==================== */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-5 pb-10 pt-16 sm:px-8 lg:w-1/2 lg:px-12 xl:w-2/5 lg:py-6 roomy:lg:py-8 tall:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-[420px] tall:max-w-[480px]"
        >
          <div className="relative rounded-[10px] border border-gray-100 bg-white px-7 pb-7 pt-14 shadow-[0_20px_60px_-24px_rgba(17,24,39,0.18)] sm:px-9 tall:px-11 tall:pb-11 tall:pt-20">
            {/* Logo tile overlapping the card's top edge */}
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-[10px] bg-white p-3 shadow-[0_-6px_20px_-12px_rgba(17,24,39,0.15)]">
              <LogoTile className="h-16 w-16 tall:h-[76px] tall:w-[76px]" />
            </div>

            <div className="mb-5 tall:mb-8">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-[15px] font-semibold uppercase tracking-[0.18em] text-gray-500">Healthcare Provider</span>
              </div>
              <h3 className="text-[30px] font-extrabold leading-tight tracking-tight text-gray-900 sm:text-[34px] tall:text-[40px]">Welcome back</h3>
              <p className="mt-1 text-[15px] text-gray-500 tall:text-[17px]">Sign in to access the nurse dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 tall:space-y-6">
              <div>
                <label htmlFor="email" className="mb-2 block text-[15px] font-semibold tall:mb-2.5 tall:text-base text-gray-900">
                  Email Address
                </label>
                <div className="group relative">
                  <Mail className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-maroon-700" />
                  <input
                    ref={emailRef}
                    id="email"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="nurse@pupbc.edu.ph"
                    autoComplete="email"
                    className={`${inputClass} pr-5`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-[15px] font-semibold tall:mb-2.5 tall:text-base text-gray-900">
                  Password
                </label>
                <div className="group relative">
                  <Lock className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-maroon-700" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onKeyUp={handleKeyDown}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className={`${inputClass} pr-14`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-[10px] p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <AnimatePresence>
                  {capsLockOn && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="mt-2 flex items-center gap-1.5 text-xs text-amber-600"
                    >
                      <AlertCircle className="h-3 w-3" />
                      Caps Lock is on
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="flex cursor-pointer select-none items-center gap-3">
                  <input
                    type="checkbox"
                    name="remember"
                    checked={form.remember}
                    onChange={handleChange}
                    className="h-5 w-5 cursor-pointer rounded-[10px] border-gray-300 text-maroon-700 focus:ring-maroon-500/20"
                  />
                  <span className="text-base text-gray-600">Remember me</span>
                </label>
                <Link
                  to="/forgot-password?portal=nurse"
                  className="text-sm font-medium text-maroon-700 transition-colors hover:text-maroon-900"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex h-[52px] w-full tall:h-[58px] items-center justify-center gap-3 rounded-full bg-maroon-800 text-[17px] font-semibold text-white transition-colors hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <LockKeyhole className="h-5 w-5" />
                    <span>Access Nurse Portal</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 flex items-center gap-4 tall:mt-8">
              <span className="h-px flex-1 bg-gray-100" />
              <p className="flex items-center gap-2 text-sm text-gray-500">
                <ShieldCheck className="h-4 w-4" />
                Secure, encrypted connection
              </p>
              <span className="h-px flex-1 bg-gray-100" />
            </div>
          </div>

          <p className="mt-5 flex items-center justify-center gap-2 text-sm lg:absolute lg:inset-x-0 lg:top-full tall:mt-7 tall:text-base text-gray-500">
            <Headset className="h-5 w-5" />
            <span>
              Need help? Contact{' '}
              <a href="#" className="font-semibold text-maroon-700 transition-colors hover:text-maroon-900">
                IT Support
              </a>
            </span>
          </p>
        </motion.div>
      </div>

      {/* ==================== Result popup ==================== */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            key="login-message"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-5 backdrop-blur-sm"
            onClick={message.type === 'error' ? closeMessage : undefined}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="login-message-title"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-[10px] bg-white p-7 text-center shadow-2xl"
            >
              <span
                className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
                  message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                {message.type === 'error' ? <AlertCircle className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
              </span>
              <h4 id="login-message-title" className="mt-5 text-xl font-bold text-gray-900">
                {message.title || (message.type === 'error' ? 'Sign-in failed' : 'Welcome back!')}
              </h4>
              <p className="mt-2 text-[15px] leading-relaxed text-gray-500">{message.text}</p>

              {message.type === 'error' ? (
                <button
                  type="button"
                  autoFocus
                  onClick={closeMessage}
                  className="mt-6 h-12 w-full rounded-full bg-maroon-800 text-[15px] font-semibold text-white transition-colors hover:bg-maroon-900"
                >
                  Try again
                </button>
              ) : (
                <div className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-emerald-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting to your dashboard...
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NurseLogin;
