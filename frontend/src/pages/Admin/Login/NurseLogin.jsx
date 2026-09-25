import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Eye, EyeOff, Loader2, Lock, Mail, Stethoscope, 
  Heart, CalendarCheck, QrCode, ShieldCheck, ClipboardList,
  Building2, GraduationCap, ChevronRight, AlertCircle, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import authService from '../../../services/authService';

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
      setMessage({ type: 'error', text: 'Please enter your email address.' });
      return;
    }
    if (!form.password.trim()) {
      setMessage({ type: 'error', text: 'Please enter your password.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      const res = await authService.nurseLogin(form.email, form.password);
      if (res.success) {
        setMessage({ type: 'success', text: 'Login successful! Redirecting...' });
        setTimeout(() => navigate('/nurse/dashboard'), 800);
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
    { icon: ClipboardList, label: 'Clinic Operations' },
  ];

  return (
    <div className="min-h-screen flex bg-[#FAFAFA] overflow-hidden">
      <div className="hidden lg:flex lg:w-[48%] xl:w-[45%] relative bg-gradient-to-br from-maroon-900 via-maroon-800 to-maroon-950 overflow-hidden">
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{ 
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px'
          }}
        />
        
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-yellow-500/5 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-maroon-400/10 blur-[100px]" />
        <div className="absolute top-1/3 right-20 w-72 h-72 rounded-full bg-yellow-400/5 blur-[80px]" />
        
        <div className="relative z-10 flex flex-col justify-between h-full p-12 xl:p-16">
          <div>
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="flex items-center gap-4"
            >
              <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
                <Stethoscope className="w-7 h-7 text-yellow-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">PUPBC CareLink</h1>
                <p className="text-sm text-white/60 tracking-wide">Clinic Management System</p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-12 space-y-3"
            >
              <div className="flex items-center gap-2 text-white/50 text-sm">
                <Building2 className="w-4 h-4" />
                <span>Polytechnic University of the Philippines</span>
              </div>
              <div className="flex items-center gap-2 text-white/50 text-sm">
                <GraduationCap className="w-4 h-4" />
                <span>Biñan Campus</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-16"
            >
              <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight">
                Nurse
                <br />
                <span className="text-yellow-400">Portal</span>
              </h2>
              <p className="mt-4 text-white/60 text-lg leading-relaxed max-w-md">
                Manage clinic operations efficiently with a modern healthcare management platform.
              </p>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="grid grid-cols-2 gap-3"
          >
            {features.map((feature, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
              >
                <feature.icon className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <span className="text-sm text-white/80 font-medium">{feature.label}</span>
              </div>
            ))}
          </motion.div>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="text-white/30 text-sm"
          >
            © {new Date().getFullYear()} PUPBC CareLink. All rights reserved.
          </motion.p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 xl:p-16 bg-[#FAFAFA]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-maroon-50/50 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-yellow-50/50 rounded-full blur-[120px] pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 w-full max-w-[440px]"
        >
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-maroon-800 to-maroon-900 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-maroon-800/20">
              <Stethoscope className="w-8 h-8 text-yellow-400" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-gray-900">Nurse Portal</h2>
            <p className="text-sm text-gray-500">PUPBC CareLink</p>
          </div>

          <div className="bg-white rounded-[28px] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] border border-gray-100 p-8 sm:p-10">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-1">
                <Heart className="w-5 h-5 text-red-400" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Healthcare Provider</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Welcome back</h3>
              <p className="text-sm text-gray-500 mt-1">Sign in to access the nurse dashboard</p>
            </div>

            <AnimatePresence>
              {message.text && (
                <motion.div 
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className={`mb-5 p-4 rounded-2xl flex items-start gap-3 text-sm ${
                    message.type === 'error' 
                      ? 'bg-red-50 text-red-700 border border-red-200' 
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {message.type === 'error' ? (
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  )}
                  <span>{message.text}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-maroon-600 transition-colors" />
                  <input
                    ref={emailRef}
                    id="email"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="nurse@pupbc.edu.ph"
                    autoComplete="email"
                    className="w-full h-12 border border-gray-200 rounded-2xl pl-12 pr-4 text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-500 outline-none transition-all duration-200 placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-maroon-600 transition-colors" />
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
                    className="w-full h-12 border border-gray-200 rounded-2xl pl-12 pr-12 text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-500 outline-none transition-all duration-200 placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <AnimatePresence>
                  {capsLockOn && (
                    <motion.p 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="text-xs text-amber-600 mt-2 flex items-center gap-1.5"
                    >
                      <AlertCircle className="w-3 h-3" />
                      Caps Lock is on
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="remember"
                    checked={form.remember}
                    onChange={handleChange}
                    className="w-4 h-4 rounded-[6px] border-gray-300 text-maroon-700 focus:ring-maroon-500/20 cursor-pointer"
                  />
                  <span className="text-sm text-gray-600">Remember me</span>
                </label>
                <button
                  type="button"
                  className="text-sm font-medium text-maroon-700 hover:text-maroon-900 transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full h-12 bg-gradient-to-r from-maroon-800 to-maroon-900 hover:from-maroon-900 hover:to-maroon-950 text-white font-semibold rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-maroon-800/10"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Access Nurse Portal</span>
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </motion.button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-6 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Secure, encrypted connection
            </p>
          </div>

          <p className="text-center text-sm text-gray-400 mt-6">
            Need help? Contact{' '}
            <a href="#" className="text-maroon-700 font-medium hover:text-maroon-900 transition-colors">
              IT Support
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default NurseLogin;