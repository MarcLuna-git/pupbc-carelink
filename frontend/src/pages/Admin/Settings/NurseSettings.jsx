import { clearSession, getUser, setUser } from '../../../services/session';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Key, Lock, Save, Loader2, Eye, EyeOff, User, Mail, Bell, Building, CheckCircle, Wrench, Clock, LogOut, Moon, SlidersHorizontal, ChevronDown, CalendarCheck, UserPlus } from 'lucide-react';
import api from '../../../services/api';
import authService from '../../../services/authService';
import useNurseSync from '../../../hooks/useNurseSync';
import { readDarkMode, saveDarkMode } from '../../../hooks/useAccountTheme';
import NursePageTitle from '../../../components/NursePageTitle';
import { fetchNurseDevTools, updateNurseTimeGuardBypass, useNurseTimeGuardBypass } from '../../../services/devTools';
import { NurseToast } from '../../../components/NurseFeedback';

/*
 * On/off row used by the General and Developer Tools tabs; same look as the
 * Student Settings switch rows.
 */
const ToggleSwitch = ({ checked, onChange, label, description, icon: Icon, disabled = false }) => (
  <div className="flex items-center justify-between gap-4 rounded-[10px] border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700/50">
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-maroon-800 shadow-sm dark:bg-gray-800 dark:text-maroon-400">
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
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500 disabled:opacity-60 ${
        checked ? 'bg-maroon-800' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  </div>
);

const SectionTitle = ({ icon: Icon, children }) => (
  <h3 className="flex items-center space-x-2 font-bold text-gray-900 dark:text-white">
    <Icon className="h-5 w-5 text-maroon-800 dark:text-maroon-400" />
    <span>{children}</span>
  </h3>
);

const SETTINGS_TABS = [
  { id: 'general', icon: SlidersHorizontal, label: 'General' },
  { id: 'profile', icon: User, label: 'Profile' },
  { id: 'password', icon: Key, label: 'Password' },
  { id: 'developer', icon: Wrench, label: 'Developer Tools' },
  { id: 'system', icon: Building, label: 'System' },
];

const NurseSettings = () => {
  const user = getUser('nurse');
  const [params] = useSearchParams();
  // Developer Tools is hidden: it only appears when opened by its direct link (?tab=developer).
  const devToolsUnlocked = params.get('tab') === 'developer';
  const tabs = SETTINGS_TABS.filter((tab) => tab.id !== 'developer' || devToolsUnlocked);
  const [activeTab, setActiveTab] = useState(devToolsUnlocked ? 'developer' : 'general');
  const [darkMode, setDarkMode] = useState(() => readDarkMode('nurse'));
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [loading, setLoading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Follow theme changes made from the header / account menu.
  useEffect(() => {
    const syncTheme = () => setDarkMode(readDarkMode('nurse'));
    window.addEventListener('darkModeChange', syncTheme);
    return () => window.removeEventListener('darkModeChange', syncTheme);
  }, []);

  const applyDarkMode = (value) => {
    setDarkMode(value);
    saveDarkMode(value, 'nurse');
    window.dispatchEvent(new Event('darkModeChange'));
  };

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    new_password_confirmation: ''
  });

  const [profile, setProfile] = useState({
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    email: user.email || '',
  });
  const [profileErrors, setProfileErrors] = useState({});
  const baseline = useRef(user);
  const draft = useRef(profile);
  draft.current = profile;
  const refreshProfile = async signal => {
    const { data } = await api.get('/auth/me', { signal });
    if (signal?.aborted) return;
    const latest = data.user;
    setUser(latest, 'nurse');
    const dirty = ['first_name', 'last_name'].some(field => draft.current[field] !== baseline.current[field]);
    if (!dirty) {
      baseline.current = latest;
      setProfile({ first_name: latest.first_name, last_name: latest.last_name, email: latest.email });
    }
  };
  useNurseSync(['students'], refreshProfile);
  useEffect(() => {
    const controller = new AbortController();
    refreshProfile(controller.signal).catch(() => {});
    return () => controller.abort();
  }, []);

  // Developer Tools → Remove time Guard (whole nurse portal, clinic-wide).
  const timeGuardOff = useNurseTimeGuardBypass();
  const [devToolsAvailable, setDevToolsAvailable] = useState(true);
  const [showDevPassword, setShowDevPassword] = useState(false);
  const [devPassword, setDevPassword] = useState('');
  const [devError, setDevError] = useState('');
  const [devSaving, setDevSaving] = useState(false);

  useEffect(() => {
    fetchNurseDevTools()
      .then((data) => setDevToolsAvailable(data?.available !== false))
      .catch(() => {});
  }, []);

  const handleTimeGuardToggle = async (turnOn) => {
    if (devSaving) return;
    setDevError('');
    if (turnOn) {
      // Removing the time guard needs the developer password.
      setShowDevPassword(true);
      return;
    }
    if (showDevPassword && !timeGuardOff) {
      // Switching back while the password prompt is open just cancels it.
      setShowDevPassword(false);
      setDevPassword('');
      return;
    }
    setDevSaving(true);
    try {
      const response = await updateNurseTimeGuardBypass(false);
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
      const response = await updateNurseTimeGuardBypass(true, devPassword);
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

  const getPasswordStrength = (password) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 2) return { level: 'Weak', color: 'bg-red-500', textColor: 'text-red-600' };
    if (score <= 3) return { level: 'Fair', color: 'bg-orange-500', textColor: 'text-orange-600' };
    if (score <= 4) return { level: 'Good', color: 'bg-blue-500', textColor: 'text-blue-600' };
    return { level: 'Strong', color: 'bg-green-500', textColor: 'text-green-600' };
  };

  const passwordStrength = getPasswordStrength(passwordForm.new_password);

  const [notifPrefs, setNotifPrefs] = useState({
    email_notifications: true,
    appointment_alerts: true,
    new_registration_alerts: true,
  });

  const [systemInfo] = useState({
    version: '3.0.0',
    lastUpdated: 'July 2026',
    environment: 'Development',
  });

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (passwordForm.new_password !== passwordForm.new_password_confirmation) {
      setMessageType('error');
      setMessage('New passwords do not match.');
      setTimeout(() => setMessage(''), 4000);
      return;
    }

    if (passwordForm.new_password.length < 8) {
      setMessageType('error');
      setMessage('Password must be at least 8 characters.');
      setTimeout(() => setMessage(''), 4000);
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await api.post('/nurse/change-password', {
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

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setMessage('');
    const errors = {};
    if (!profile.first_name.trim()) errors.first_name = 'First name is required.';
    else if (profile.first_name.length > 100) errors.first_name = 'First name must be 100 characters or fewer.';
    if (!profile.last_name.trim()) errors.last_name = 'Last name is required.';
    else if (profile.last_name.length > 100) errors.last_name = 'Last name must be 100 characters or fewer.';
    setProfileErrors(errors);
    if (Object.keys(errors).length) return;

    setLoading(true);
    setMessage('');

    try {
      const response = await api.put('/nurse/profile', profile, {
        headers: { 'If-Match': baseline.current.sync_version }
      });

      const updatedUser = response.data.data;
      baseline.current = updatedUser;
      setUser(updatedUser, 'nurse');

      setMessageType('success');
      setMessage('Profile updated successfully!');
    } catch (err) {
      setMessageType('error');
      setMessage(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => setShowLogoutConfirm(true);

  const confirmLogout = async () => {
    setLogoutLoading(true);
    try {
      await authService.logout('nurse');
      window.location.href = '/carelink-portal';
    } catch (err) {
      clearSession('nurse');
      window.location.href = '/carelink-portal';
    } finally {
      setLogoutLoading(false);
    }
  };

  const inputClass = "w-full border border-gray-200 dark:border-gray-600 rounded-[10px] px-4 py-3 text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-maroon-500 focus:outline-none";
  const labelClass = "text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5";
  const primaryButton = "w-full py-3 bg-maroon-800 text-white font-semibold rounded-[10px] hover:bg-maroon-900 transition flex items-center justify-center space-x-2 disabled:opacity-50";

  // Shared panel body: right column on tablet / desktop, inside the opened
  // accordion item on mobile.
  const renderPanel = (id) => {
    if (id === 'general') {
      return (
        <div className="space-y-6">
          <div className="space-y-4">
            <SectionTitle icon={Moon}>Appearance</SectionTitle>
            <ToggleSwitch
              icon={Moon}
              label="Dark mode"
              description="Switch between the light and dark theme."
              checked={darkMode}
              onChange={applyDarkMode}
            />
          </div>

          <div className="space-y-4 border-t border-gray-100 pt-5 dark:border-gray-700">
            <SectionTitle icon={Bell}>Notification Preferences</SectionTitle>
            <div className="space-y-3">
              {[
                { key: 'email_notifications', icon: Mail, label: 'Email Notifications', desc: 'Receive email notifications' },
                { key: 'appointment_alerts', icon: CalendarCheck, label: 'Appointment Alerts', desc: 'Get notified for new appointments' },
                { key: 'new_registration_alerts', icon: UserPlus, label: 'Registration Alerts', desc: 'Get notified for new student registrations' },
              ].map((item) => (
                <ToggleSwitch
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  description={item.desc}
                  checked={notifPrefs[item.key]}
                  onChange={(value) => setNotifPrefs({ ...notifPrefs, [item.key]: value })}
                />
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (id === 'profile') {
      return (
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <SectionTitle icon={User}>Profile Information</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>First Name</label>
              <input
                className={inputClass}
                type="text"
                maxLength={100}
                value={profile.first_name}
                onChange={(e) => {
                  const first_name = e.target.value.replace(/[^\p{L}\s\-'.]/gu, '');
                  setProfile({...profile, first_name});
                  setProfileErrors((current) => ({ ...current, first_name: '' }));
                }}
                placeholder="First Name"
              />
              {profileErrors.first_name && <p role="alert" className="mt-1 text-xs text-red-600">{profileErrors.first_name}</p>}
            </div>
            <div>
              <label className={labelClass}>Last Name</label>
              <input
                className={inputClass}
                type="text"
                maxLength={100}
                value={profile.last_name}
                onChange={(e) => {
                  const last_name = e.target.value.replace(/[^\p{L}\s\-'.]/gu, '');
                  setProfile({...profile, last_name});
                  setProfileErrors((current) => ({ ...current, last_name: '' }));
                }}
                placeholder="Last Name"
              />
              {profileErrors.last_name && <p role="alert" className="mt-1 text-xs text-red-600">{profileErrors.last_name}</p>}
            </div>
          </div>
          <div>
            <label className={labelClass}>Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full cursor-not-allowed rounded-[10px] border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400"
                type="email"
                value={profile.email}
                disabled
                title="Email cannot be changed"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">Email cannot be changed. Contact the clinic for changes.</p>
          </div>
          <button type="submit" disabled={loading} className={primaryButton}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{loading ? 'Saving...' : 'Update Profile'}</span>
          </button>
        </form>
      );
    }

    if (id === 'password') {
      return (
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <SectionTitle icon={Key}>Change Password</SectionTitle>

          <div>
            <label className={labelClass}>Current Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className={`${inputClass} pl-10 pr-12`}
                type={showCurrentPass ? 'text' : 'password'}
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({...passwordForm, current_password: e.target.value})}
                placeholder="Enter current password"
                required
              />
              <button type="button" onClick={() => setShowCurrentPass(!showCurrentPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-[10px] p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600">
                {showCurrentPass ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className={labelClass}>New Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className={`${inputClass} pl-10 pr-12`}
                type={showNewPass ? 'text' : 'password'}
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})}
                placeholder="Min 8 characters"
                required
              />
              <button type="button" onClick={() => setShowNewPass(!showNewPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-[10px] p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600">
                {showNewPass ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
            {passwordForm.new_password && (
              <div className="mt-2">
                <div className="mb-1 flex gap-1">
                  <div className={`h-1.5 flex-1 rounded-full ${passwordStrength.color}`}></div>
                  <div className={`h-1.5 flex-1 rounded-full ${passwordStrength.level === 'Weak' ? 'bg-gray-200' : passwordStrength.color}`}></div>
                  <div className={`h-1.5 flex-1 rounded-full ${['Weak', 'Fair'].includes(passwordStrength.level) ? 'bg-gray-200' : passwordStrength.color}`}></div>
                </div>
                <p className={`text-xs font-medium ${passwordStrength.textColor}`}>
                  Strength: {passwordStrength.level}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className={`${inputClass} pl-10 ${
                  passwordForm.new_password_confirmation && passwordForm.new_password === passwordForm.new_password_confirmation
                    ? 'border-green-400 bg-green-50 dark:bg-green-900/10'
                    : passwordForm.new_password_confirmation && passwordForm.new_password !== passwordForm.new_password_confirmation
                    ? 'border-red-400 bg-red-50 dark:bg-red-900/10'
                    : ''
                }`}
                type="password"
                value={passwordForm.new_password_confirmation}
                onChange={(e) => setPasswordForm({...passwordForm, new_password_confirmation: e.target.value})}
                placeholder="Re-enter new password"
                required
              />
            </div>
            {passwordForm.new_password_confirmation && passwordForm.new_password === passwordForm.new_password_confirmation && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-600"><CheckCircle className="h-3 w-3" /> Passwords match</p>
            )}
            {passwordForm.new_password_confirmation && passwordForm.new_password !== passwordForm.new_password_confirmation && (
              <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
            )}
          </div>

          <button type="submit" disabled={loading} className={primaryButton}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{loading ? 'Saving...' : 'Update Password'}</span>
          </button>
        </form>
      );
    }

    if (id === 'developer') {
      return (
        <div className="space-y-4">
          <SectionTitle icon={Wrench}>Developer Tools</SectionTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400">Testing tools for the clinic flow. Applies to the whole nurse portal.</p>

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
                  ? 'On: appointments do not auto-expire; queue deadlines and past reschedule, follow-up and medicine expiry dates are not enforced.'
                  : 'Off: normal nurse portal time rules apply.'}
                checked={timeGuardOff || showDevPassword}
                disabled={devSaving}
                onChange={handleTimeGuardToggle}
              />

              {showDevPassword && !timeGuardOff && (
                <form onSubmit={confirmTimeGuardBypass} className="space-y-3 rounded-[10px] border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    Enter the developer password to remove the time guard.
                  </p>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      autoComplete="off"
                      autoFocus
                      value={devPassword}
                      onChange={(e) => { setDevPassword(e.target.value); setDevError(''); }}
                      className={`${inputClass} pl-10`}
                      placeholder="Developer password"
                      aria-label="Developer password"
                      required
                    />
                  </div>
                  {devError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{devError}</p>}
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={devSaving || !devPassword}
                      className="inline-flex items-center space-x-2 rounded-[10px] bg-maroon-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-900 disabled:opacity-50">
                      {devSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
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
        </div>
      );
    }

    if (id === 'system') {
      return (
        <div className="space-y-6">
          <div className="space-y-4">
            <SectionTitle icon={Building}>System Information</SectionTitle>
            <div className="space-y-3 text-sm">
              {[
                ['Version', systemInfo.version],
                ['Last Updated', systemInfo.lastUpdated],
                ['Environment', systemInfo.environment],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between rounded-[10px] bg-gray-50 p-4 dark:bg-gray-700/50">
                  <span className="text-gray-500 dark:text-gray-400">{label}</span>
                  <span className="font-medium text-gray-700 dark:text-gray-200">{value}</span>
                </div>
              ))}
              <div className="flex justify-between rounded-[10px] bg-gray-50 p-4 dark:bg-gray-700/50">
                <span className="text-gray-500 dark:text-gray-400">Logged in as</span>
                <span className="font-medium capitalize text-maroon-700 dark:text-maroon-400">{user.role || 'Nurse'}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-gray-100 pt-5 dark:border-gray-700">
            <SectionTitle icon={LogOut}>Session</SectionTitle>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center space-x-2 rounded-[10px] bg-red-50 py-3 font-semibold text-red-700 transition hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <NursePageTitle path="/nurse/settings" />

      {/* Action results show as a floating toast */}
      <NurseToast message={message} type={messageType} onClose={() => setMessage('')} />

      <div className="rounded-[10px] border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 lg:p-6">
        <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
          {/* Mobile: accordion — tapping a section slides its panel open beneath it */}
          <div className="space-y-2 md:hidden">
            {tabs.map((tab) => {
              const isOpen = activeTab === tab.id;
              return (
                <div key={tab.id} className="overflow-hidden rounded-[10px] border border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setActiveTab(isOpen ? '' : tab.id)}
                    aria-expanded={isOpen}
                    aria-controls={`nurse-settings-panel-${tab.id}`}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold transition-colors ${
                      isOpen
                        ? 'bg-maroon-800 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <tab.icon className="h-4 w-4 shrink-0" />
                      <span>{tab.label}</span>
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`nurse-settings-panel-${tab.id}`}
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

          {/* Tablet / desktop: vertical tab rail */}
          <nav aria-label="Settings sections" className="hidden md:flex md:flex-col">
            {tabs.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                aria-pressed={(activeTab || 'general') === tab.id}
                className={`flex w-full items-center gap-3 rounded-[10px] border-b border-gray-100 px-4 py-3 text-left text-sm font-semibold transition-colors last:border-b-0 dark:border-gray-700 ${
                  activeTab === tab.id ? 'bg-maroon-800 text-white' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50'
                }`}>
                <tab.icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Tablet / desktop: panel */}
          <div className="hidden min-w-0 md:block md:border-l md:border-gray-300 md:pl-5 dark:border-gray-600">
            {/* All panels share one grid cell, so the card keeps the height
                of the tallest panel and switching tabs never shrinks the
                page (which made the scroll jump like a page change). */}
            <div className="grid">
              {tabs.map((tab) => {
                const shown = (activeTab || 'general') === tab.id;
                return (
                  <div
                    key={tab.id}
                    aria-hidden={!shown}
                    className={`[grid-area:1/1] min-w-0 ${shown ? '' : 'invisible pointer-events-none'}`}
                  >
                    {renderPanel(tab.id)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="settings-logout-title" className="w-full max-w-sm rounded-[10px] bg-white p-6 shadow-2xl dark:bg-gray-800">
            <h2 id="settings-logout-title" className="text-lg font-bold text-gray-900 dark:text-white">Sign out?</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Are you sure you want to end your nurse session?</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setShowLogoutConfirm(false)} disabled={logoutLoading} className="flex-1 rounded-[10px] bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200">Cancel</button>
              <button type="button" onClick={confirmLogout} disabled={logoutLoading} className="flex-1 rounded-[10px] bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{logoutLoading ? 'Signing out...' : 'Sign Out'}</button>
            </div>
          </section>
        </div>
      )}

      <p className="pb-8 text-center text-xs text-gray-400">
        PUPBC CareLink v{systemInfo.version} • PUP Biñan Campus Clinic
      </p>
    </div>
  );
};

export default NurseSettings;
