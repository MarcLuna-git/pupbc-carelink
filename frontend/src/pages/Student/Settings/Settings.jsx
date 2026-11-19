import { getUser, setUser } from '../../../services/session';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Key, Mail, Shield, Eye, EyeOff, Loader2, Save, Moon, Lock, SlidersHorizontal, MessageSquare, ChevronDown, Trash2, Wrench, Clock } from 'lucide-react';
import api from '../../../services/api';
import useStudentWidgetPrefs from '../../../hooks/useStudentWidgetPrefs';
import { readDarkMode, saveDarkMode } from '../../../hooks/useAccountTheme';
import StudentPageHero from '../../../components/StudentPageHero';
import { fetchDevTools, updateTimeGuardBypass, useTimeGuardBypass } from '../../../services/devTools';
import { StudentToast } from '../../../components/StudentFeedback';
import { useStudentBreadcrumbTab } from '../../../utils/studentBreadcrumb';

// Same hero as the other Student pages (aurora + tab icon).
const SETTINGS_HERO = {
  id: 'settings-title',
  title: 'Settings',
  description: 'Manage your account, security, and portal preferences.',
};

/*
 * Small on/off switch used by the General tab. Plain Tailwind (this page has
 * no custom stylesheet) so it matches the rest of the Settings card styling.
 */
const ToggleSwitch = ({ checked, onChange, label, description, icon: Icon }) => (
  <div className="flex items-center justify-between gap-4 rounded-[10px] border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-4">
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-maroon-800 shadow-sm dark:bg-gray-800 dark:text-maroon-300">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800 dark:text-white">{label}</p>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500 ${
        checked ? 'bg-maroon-800' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  </div>
);

/*
 * Route-loading ghost blocks. Shimmer-only (no spinner) — same
 * `animate-pulse` pattern the Alerts / Dashboard pages use.
 */
const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded-[10px] bg-gray-200 dark:bg-gray-700 ${className}`} />
);

/* Ghost of a ToggleSwitch row — mirrors the real switch's exact layout. */
const SkeletonToggle = () => (
  <div className="flex items-center justify-between gap-4 rounded-[10px] border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700/50">
    <div className="flex min-w-0 items-start gap-3">
      <Skeleton className="h-9 w-9 shrink-0 rounded-[10px]" />
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2.5 w-48 max-w-full" />
      </div>
    </div>
    <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
  </div>
);

/* Ghost of a section heading (icon + label). */
const SkeletonHeading = () => (
  <div className="flex items-center gap-2">
    <Skeleton className="h-5 w-5 rounded-[10px]" />
    <Skeleton className="h-4 w-24" />
  </div>
);

const Settings = () => {
  const [params] = useSearchParams();
  const user = getUser('student');
  const { prefs, setPref } = useStudentWidgetPrefs();
  const [activeTab, setActiveTab] = useState(params.get('tab') || 'general');

  /*
   * ROUTE LOADING — the restored loading effect, scoped to this page.
   * LOADING PHASE: only the hero section is visible (with a progress bar),
   * the tab rail and panel area render as shimmering ghosts.
   * LOADED PHASE: the real content fades in.
   *
   * TEMP DEMO TIMER: ROUTE_LOADING_DELAY holds the loading phase so the
   * animation is visible. The lazy chunk is already preloaded on
   * hover/focus, so this state is purely cosmetic — shorten or remove the
   * delay once the final timing is decided.
   */
  const ROUTE_LOADING_DELAY = 1600;
  const [routeLoading, setRouteLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setRouteLoading(false), ROUTE_LOADING_DELAY);
    return () => clearTimeout(timer);
  }, []);

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [darkMode, setDarkMode] = useState(() => readDarkMode('student'));

  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', new_password_confirmation: '' });
  const [emailForm, setEmailForm] = useState({ new_email: '', password: '', otp: '' });
  // Email change: 'details' (new email + password) → 'otp' (code sent to the new email).
  const [emailStep, setEmailStep] = useState('details');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetPassword, setResetPassword] = useState('');

  // Developer Tools → Remove time Guard.
  const timeGuardOff = useTimeGuardBypass();
  const [devToolsAvailable, setDevToolsAvailable] = useState(true);
  const [showDevPassword, setShowDevPassword] = useState(false);
  const [devPassword, setDevPassword] = useState('');
  const [devError, setDevError] = useState('');
  const [devSaving, setDevSaving] = useState(false);

  useEffect(() => {
    fetchDevTools()
      .then((data) => setDevToolsAvailable(data?.available !== false))
      .catch(() => {});
  }, []);

  const handleTimeGuardToggle = async (turnOn) => {
    setDevError('');
    if (turnOn) {
      // Turning the time guard off for testing needs the developer password.
      setShowDevPassword(true);
      return;
    }
    setDevSaving(true);
    try {
      const response = await updateTimeGuardBypass(false);
      setMessageType('success');
      setMessage(response?.message || 'Time guard restored.');
    } catch (err) {
      setMessageType('error');
      setMessage(err.response?.data?.message || 'Could not restore the time guard.');
    } finally {
      setDevSaving(false);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const confirmTimeGuardBypass = async (e) => {
    e.preventDefault();
    setDevSaving(true);
    setDevError('');
    try {
      const response = await updateTimeGuardBypass(true, devPassword);
      setShowDevPassword(false);
      setDevPassword('');
      setMessageType('success');
      setMessage(response?.message || 'Time guard removed.');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setDevError(err.response?.data?.errors?.password?.[0] || err.response?.data?.message || 'Could not remove the time guard.');
    } finally {
      setDevSaving(false);
    }
  };

  const applyDarkMode = (value) => {
    setDarkMode(value);
    saveDarkMode(value, 'student');
    if (value) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    window.dispatchEvent(new Event('darkModeChange'));
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.new_password_confirmation) {
      setMessageType('error');
      setMessage('Passwords do not match.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    if (passwordForm.new_password.length < 8) {
      setMessageType('error');
      setMessage('Password must be at least 8 characters.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setLoading(true); setMessage('');
    try {
      await api.post('/auth/change-password', {
        email: user.email,
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
        new_password_confirmation: passwordForm.new_password_confirmation,
      });

      setMessageType('success');
      setMessage('Password updated successfully!');
      setPasswordForm({ current_password: '', new_password: '', new_password_confirmation: '' });
    } catch (err) {
      setMessageType('error');
      setMessage(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const handleEmailChange = async (e) => {
    e.preventDefault();
    setLoading(true); setMessage('');
    try {
      if (emailStep === 'details') {
        const response = await api.post('/student/profile/email/otp', { email: emailForm.new_email, password: emailForm.password });
        setEmailStep('otp');
        setEmailForm(current => ({ ...current, password: '', otp: '' }));
        setMessageType('success');
        setMessage(response.data.message);
        return;
      }
      const response = await api.patch('/student/profile/email', { otp: emailForm.otp });
      const storedUser = getUser('student');
      setUser({ ...storedUser, email: response.data.data.email }, 'student');
      window.dispatchEvent(new Event('studentProfileUpdated'));
      setMessageType('success');
      setMessage('Email updated successfully. Use your updated email the next time you log in.');
      setEmailForm({ new_email: '', password: '', otp: '' });
      setEmailStep('details');
    } catch (err) {
      setMessageType('error');
      setMessage(Object.values(err.response?.data?.errors || {}).flat().join(' ') || err.response?.data?.message || 'Failed to update email.');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 6000);
    }
  };

  const restartEmailChange = () => {
    setEmailStep('details');
    setEmailForm({ new_email: emailForm.new_email, password: '', otp: '' });
    setMessage('');
  };

  const handleResetData = async (e) => {
    e.preventDefault();
    setLoading(true); setMessage('');
    try {
      const response = await api.post('/student/reset-data', { password: resetPassword });

      /*
       * Mirror the wipe locally so every Student page (and the header) stops
       * showing data that no longer exists. Device-only preferences such as
       * the widget toggles and dark mode are deliberately left alone.
       */
      const storedUser = getUser('student');
      const clearedUser = {
        ...storedUser,
        mobile_number: null,
        profile: {
          ...(storedUser.profile || {}),
          mobile_number: null,
          address: null,
          guardian_name: null,
          guardian_relationship: null,
          guardian_contact: null,
          profile_picture: null,
          health_profile_completed: false,
        },
      };
      setUser(clearedUser, 'student');
      localStorage.removeItem('carelink.student.appointments');
      localStorage.removeItem('carelink.student.dashboard');

      window.dispatchEvent(new CustomEvent('carelink:student-user-updated', { detail: { user: clearedUser } }));
      window.dispatchEvent(new Event('studentProfileUpdated'));
      // Invalidates the cached completion flag so the route guard re-checks it.
      window.dispatchEvent(new Event('carelink:health-profile-saved'));

      setMessageType('success');
      setMessage(response.data?.message || 'Your data has been reset.');
      setResetPassword('');
      setShowResetConfirm(false);
    } catch (err) {
      setMessageType('error');
      setMessage(Object.values(err.response?.data?.errors || {}).flat().join(' ') || err.response?.data?.message || 'Failed to reset your data.');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const desktopTabs = [
    { id: 'general', icon: SlidersHorizontal, label: 'General', desc: 'Widgets, theme & preferences' },
    { id: 'password', icon: Key, label: 'Password', desc: 'Change your password' },
    { id: 'email', icon: Mail, label: 'Email', desc: 'Update email address' },
    { id: 'privacy', icon: Shield, label: 'Privacy', desc: 'Data & privacy' },
    { id: 'developer', icon: Wrench, label: 'Developer Tools', desc: 'Testing tools' },
  ];

  // Developer Tools is hidden: it only appears when opened by its direct link (?tab=developer).
  const devToolsUnlocked = params.get('tab') === 'developer';
  const tabs = desktopTabs.filter(tab => tab.id !== 'developer' || devToolsUnlocked);
  useStudentBreadcrumbTab(desktopTabs.find(tab => tab.id === activeTab)?.label);

  // Shared panel body, rendered in the right column on desktop and slid open
  // inside the tapped accordion item on mobile.
  const renderPanel = (id) => {
    if (id === 'general') {
      return (
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <SlidersHorizontal className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
              <span>General</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Turn the Student portal floating widgets on or off.
            </p>

            <div className="space-y-3">
              <ToggleSwitch
                icon={MessageSquare}
                label="CareLink chat assistant"
                description="Floating chatbot for quick questions."
                checked={prefs.chatWidget}
                onChange={(value) => setPref('chatWidget', value)}
              />
            </div>
          </div>

          <div className="space-y-4 border-t border-gray-100 dark:border-gray-700 pt-5">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <Moon className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
              <span>Appearance</span>
            </h3>

            <ToggleSwitch
              icon={Moon}
              label="Dark mode"
              description="Switch between the light and dark theme."
              checked={darkMode}
              onChange={applyDarkMode}
            />
          </div>
        </div>
      );
    }

    if (id === 'password') {
      return (
        <form onSubmit={handlePasswordChange} autoComplete="off" className="space-y-4">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <Key className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
            <span>Change Password</span>
          </h3>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5">Current Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({...passwordForm, current_password: e.target.value})}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-[10px] pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                placeholder="Enter current password" required />
              <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1.5 rounded-[10px] hover:bg-gray-100 dark:hover:bg-gray-600">
                {showCurrentPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-[10px] pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                placeholder="Min 8 characters" required />
              <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1.5 rounded-[10px] hover:bg-gray-100 dark:hover:bg-gray-600">
                {showNewPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={passwordForm.new_password_confirmation}
                onChange={(e) => setPasswordForm({...passwordForm, new_password_confirmation: e.target.value})}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-[10px] pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                placeholder="Re-enter new password" required />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1.5 rounded-[10px] hover:bg-gray-100 dark:hover:bg-gray-600">
                {showConfirmPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-maroon-800 text-white font-semibold rounded-[10px] hover:bg-maroon-900 transition flex items-center justify-center space-x-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{loading ? 'Saving...' : 'Update Password'}</span>
          </button>
        </form>
      );
    }

    if (id === 'email') {
      return (
        <form onSubmit={handleEmailChange} autoComplete="off" className="space-y-4">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <Mail className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
            <span>Change Email</span>
          </h3>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5">Current Email</label>
            <input type="email" value={user.email || ''} disabled
              className="w-full border border-gray-200 dark:border-gray-600 rounded-[10px] px-4 py-3 text-sm bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed" />
          </div>
          {emailStep === 'details' ? <>
            <div>
              <label htmlFor="settings-new-email" className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5">New Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input id="settings-new-email" type="email" value={emailForm.new_email} onChange={(e) => setEmailForm({...emailForm, new_email: e.target.value})}
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-[10px] pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" required />
              </div>
            </div>
            <div>
              <label htmlFor="settings-email-password" className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5">Confirm Password</label>
              <div className="relative">
                <input id="settings-email-password" type={showEmailPassword ? 'text' : 'password'} value={emailForm.password} onChange={(e) => setEmailForm({...emailForm, password: e.target.value})}
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-[10px] pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" required />
                <button type="button" onClick={() => setShowEmailPassword(!showEmailPassword)}
                  aria-label={showEmailPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1.5 rounded-[10px] hover:bg-gray-100 dark:hover:bg-gray-600">
                  {showEmailPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </> : <div>
            <label htmlFor="settings-email-otp" className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5">Verification Code</label>
            <input id="settings-email-otp" type="text" inputMode="numeric" autoComplete="off" maxLength={6} pattern="\d{6}" value={emailForm.otp}
              onChange={(e) => setEmailForm({...emailForm, otp: e.target.value.replace(/\D/g, '').slice(0, 6)})} autoFocus placeholder="000000"
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-[10px] px-4 py-3 text-center text-lg tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-maroon-500" required />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Enter the 6-digit code we sent to <strong className="text-gray-700 dark:text-gray-200">{emailForm.new_email}</strong>. <button type="button" onClick={restartEmailChange} disabled={loading} className="font-semibold text-maroon-800 hover:underline dark:text-maroon-300">Change email or resend code</button></p>
          </div>}
          <button type="submit" disabled={loading || (emailStep === 'otp' && emailForm.otp.length !== 6)}
            className="w-full py-3 bg-maroon-800 text-white font-semibold rounded-[10px] hover:bg-maroon-900 transition flex items-center justify-center space-x-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : emailStep === 'details' ? <Mail className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{loading ? (emailStep === 'details' ? 'Sending code...' : 'Saving...') : emailStep === 'details' ? 'Send Verification Code' : 'Verify & Update Email'}</span>
          </button>
        </form>
      );
    }

    if (id === 'privacy') {
      return (
        <div className="space-y-4">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <Shield className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
            <span>Privacy & Data</span>
          </h3>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-[10px] p-4">
              <p className="font-semibold text-gray-800 dark:text-white mb-1">Medical Records</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Only authorized clinic staff can access your records.</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-[10px] p-4">
              <p className="font-semibold text-gray-800 dark:text-white mb-1">Data Request</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Contact the clinic administrator to request your data.</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-[10px] p-4">
              <p className="font-semibold text-gray-800 dark:text-white mb-1">Data Privacy Act</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Your data is protected under RA 10173 (Data Privacy Act of 2012).</p>
            </div>
          </div>
        </div>
      );
    }

    if (id === 'developer') {
      return (
        <div className="space-y-4">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <Wrench className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
            <span>Developer Tools</span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Testing tools for the clinic flow. Changes apply to your account only.
          </p>

          {!devToolsAvailable ? (
            <p className="rounded-[10px] bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-700/50 dark:text-gray-400">
              Developer Tools are turned off on this server.
            </p>
          ) : (
            <>
              <ToggleSwitch
                icon={Clock}
                label="Remove time Guard"
                description={timeGuardOff
                  ? 'On: you can book past dates and times and Sundays. Nurse and kiosk rules still apply.'
                  : 'Off: normal booking time rules apply.'}
                checked={timeGuardOff || showDevPassword}
                onChange={(value) => {
                  if (devSaving) return;
                  // Switching back while the password prompt is open just cancels it.
                  if (!value && showDevPassword && !timeGuardOff) { setShowDevPassword(false); setDevPassword(''); setDevError(''); return; }
                  handleTimeGuardToggle(value);
                }}
              />

              {showDevPassword && !timeGuardOff && (
                <form onSubmit={confirmTimeGuardBypass} className="space-y-3 rounded-[10px] border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    Enter the developer password to remove the time guard.
                  </p>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      autoComplete="off"
                      autoFocus
                      value={devPassword}
                      onChange={(e) => { setDevPassword(e.target.value); setDevError(''); }}
                      className="w-full border border-amber-200 dark:border-amber-900/60 dark:bg-gray-700 dark:text-white rounded-[10px] pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                      placeholder="Developer password"
                      aria-label="Developer password"
                      required
                    />
                  </div>
                  {devError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{devError}</p>}
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={devSaving || !devPassword}
                      className="inline-flex items-center space-x-2 rounded-[10px] bg-maroon-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-900 disabled:opacity-50">
                      {devSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                      <span>{devSaving ? 'Checking...' : 'Remove time guard'}</span>
                    </button>
                    <button type="button" disabled={devSaving}
                      onClick={() => { setShowDevPassword(false); setDevPassword(''); setDevError(''); }}
                      className="rounded-[10px] px-4 py-2.5 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700/50">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          <div className="space-y-3 border-t border-gray-100 pt-4 dark:border-gray-700">
            <ToggleSwitch
              icon={Trash2}
              label="Reset data"
              description="Deletes the appointments, QR / check-in history, profile details and health profile you entered, so you can start over. Your account and clinic medical records are kept."
              checked={showResetConfirm}
              onChange={(value) => {
                if (loading) return;
                // On opens the confirmation; off cancels it.
                setShowResetConfirm(value);
                if (!value) setResetPassword('');
              }}
            />

            {showResetConfirm && (
              <form onSubmit={handleResetData} className="space-y-3 rounded-[10px] border border-red-200 bg-red-50/60 p-4 dark:border-red-900/60 dark:bg-red-950/20">
                <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                  This cannot be undone. Enter the developer password to confirm.
                </p>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="w-full border border-red-200 dark:border-red-900/60 dark:bg-gray-700 dark:text-white rounded-[10px] pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Developer password" aria-label="Developer password" autoComplete="off" required />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={loading}
                    className="inline-flex items-center space-x-2 rounded-[10px] bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    <span>{loading ? 'Resetting...' : 'Confirm reset'}</span>
                  </button>
                  <button type="button" disabled={loading}
                    onClick={() => { setShowResetConfirm(false); setResetPassword(''); }}
                    className="rounded-[10px] px-4 py-2.5 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700/50">
                    Cancel
                  </button>
                </div>
              </form>
              )}
          </div>
        </div>
      );
    }

    return null;
  };

  /*
   * LOADING PHASE — only the hero section is real. The tab rail and panel
   * area render as shimmering ghosts, and a progress bar sweeps across the
   * bottom edge of the hero until the timer flips to the loaded phase.
   */
  if (routeLoading) {
    return (
      <div className="space-y-5 max-w-[1440px] mx-auto">

        <StudentPageHero {...SETTINGS_HERO} loading />

        <div className="rounded-[10px] border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 lg:p-6">
          {/* Content-card ghost — mirrors the loaded layout 1:1 (same grid,
              same DOM order, same General-tab stack) so the reveal is
              seamless with no layout jump. */}
          <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
            {/* Ghost of the mobile accordion (hidden on md+, like the real one) */}
            <div className="space-y-2 md:hidden">
              {desktopTabs.map((tab) => (
                <div key={tab.id} className="overflow-hidden rounded-[10px] border border-gray-200 dark:border-gray-700">
                  <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
                    <span className="flex items-center gap-3">
                      <Skeleton className="h-4 w-4 rounded-[10px]" />
                      <Skeleton className="h-3 w-24" />
                    </span>
                    <Skeleton className="h-4 w-4 rounded-[10px]" />
                  </div>
                </div>
              ))}
            </div>

            {/* Ghost of the desktop tab rail — first row shows the active maroon tab */}
            <div className="hidden md:flex md:flex-col">
              {desktopTabs.map((tab, index) => {
                const active = index === 0;
                return (
                  <div key={tab.id} className={`flex w-full items-center gap-3 rounded-[10px] border-b border-gray-100 px-4 py-3 last:border-b-0 dark:border-gray-700 ${active ? 'bg-maroon-800' : ''}`}>
                    <Skeleton className={`h-4 w-4 shrink-0 rounded-[10px] ${active ? 'bg-white/40' : ''}`} />
                    <Skeleton className={`h-3 w-24 ${active ? 'bg-white/40' : ''}`} />
                  </div>
                );
              })}
            </div>

            {/* Ghost of the panel — mirrors the General tab's real stack:
                General (toggle) → Appearance (toggle) */}
            <div className="hidden min-w-0 md:block md:border-l md:border-gray-300 md:pl-5 dark:border-gray-600">
              <div className="space-y-6">
                <div className="space-y-4">
                  <SkeletonHeading />
                  <Skeleton className="h-3 w-64 max-w-full" />
                  <SkeletonToggle />
                </div>

                <div className="space-y-4 border-t border-gray-100 pt-5 dark:border-gray-700">
                  <SkeletonHeading />
                  <SkeletonToggle />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[1440px] mx-auto">

      <StudentPageHero {...SETTINGS_HERO} />

      <StudentToast message={message} type={messageType} onClose={() => setMessage('')} />

      {/* LOADED PHASE — the real tabs and panels fade in once route loading completes. */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700 p-4 lg:p-6"
      >
        <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
          {/* Mobile: accordion — tapping a section slides its panel open beneath it */}
          <div className="space-y-2 md:hidden">
            {tabs.map(tab => {
              const isOpen = activeTab === tab.id;
              return (
                <div key={tab.id} className="overflow-hidden rounded-[10px] border border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setActiveTab(isOpen ? '' : tab.id)}
                    aria-expanded={isOpen}
                    aria-controls={`settings-panel-${tab.id}`}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold transition-colors ${
                      isOpen
                        ? 'bg-maroon-800 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <tab.icon className="w-4 h-4 shrink-0" />
                      <span>{tab.label}</span>
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`settings-panel-${tab.id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                          {renderPanel(tab.id)}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Desktop / tablet: vertical tab rail */}
          <nav aria-label="Settings sections" className="hidden md:flex md:flex-col">
            {tabs.map(tab => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-[10px] border-b border-gray-100 px-4 py-3 text-left text-sm font-semibold transition-colors last:border-b-0 dark:border-gray-700 ${
                  activeTab === tab.id ? 'bg-maroon-800 text-white' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50'
                }`}>
                <tab.icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Desktop / tablet: panel */}
          <div className="hidden min-w-0 md:block md:border-l md:border-gray-300 md:pl-5 dark:border-gray-600">
            {renderPanel(activeTab)}
          </div>
        </div>
      </motion.div>


    </div>
  );
};

export default Settings;
