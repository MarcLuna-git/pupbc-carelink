import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Key, Mail, Shield, Eye, EyeOff, Loader2, Save, Moon, Lock, SlidersHorizontal, HelpCircle, MessageSquare, ChevronDown, AlertTriangle, Trash2 } from 'lucide-react';
import api from '../../../services/api';
import useStudentWidgetPrefs from '../../../hooks/useStudentWidgetPrefs';

/*
 * Small on/off switch used by the General tab. Plain Tailwind (this page has
 * no custom stylesheet) so it matches the rest of the Settings card styling.
 */
const ToggleSwitch = ({ checked, onChange, label, description, icon: Icon }) => (
  <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-4">
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-maroon-800 shadow-sm dark:bg-gray-800 dark:text-maroon-300">
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

const Settings = () => {
  const [params] = useSearchParams();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const { prefs, setPref } = useStudentWidgetPrefs();
  const [activeTab, setActiveTab] = useState(params.get('tab') || 'general');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;

  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', new_password_confirmation: '' });
  const [emailForm, setEmailForm] = useState({ new_email: '', password: '' });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetPassword, setResetPassword] = useState('');

  const applyDarkMode = (value) => {
    setDarkMode(value);
    localStorage.setItem('darkMode', value.toString());
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
      const token = localStorage.getItem('token');
      await api.post('/auth/change-password', {
        email: user.email,
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
        new_password_confirmation: passwordForm.new_password_confirmation,
      }, { headers: { Authorization: `Bearer ${token}` } });

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
      const response = await api.patch('/student/profile/email', { email: emailForm.new_email, password: emailForm.password });
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...storedUser, email: response.data.data.email }));
      window.dispatchEvent(new Event('studentProfileUpdated'));
      setMessageType('success');
      setMessage('Email updated successfully. Use your updated email the next time you log in.');
      setEmailForm({ new_email: '', password: '' });
    } catch (err) {
      setMessageType('error');
      setMessage(Object.values(err.response?.data?.errors || {}).flat().join(' ') || err.response?.data?.message || 'Failed to update email.');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 4000);
    }
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
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
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
      localStorage.setItem('user', JSON.stringify(clearedUser));
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
  ];

  const tabs = isDesktop ? desktopTabs : desktopTabs;

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
              Turn the Student portal widgets and header helpers on or off.
            </p>

            <div className="space-y-3">
              <ToggleSwitch
                icon={HelpCircle}
                label="Help & Support widget"
                description="Floating shortcut to clinic and portal guidance."
                checked={prefs.helpWidget}
                onChange={(value) => setPref('helpWidget', value)}
              />

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

          <div className="space-y-4 border-t border-gray-100 dark:border-gray-700 pt-5">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span>Reset data</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Deletes the appointments, QR / check-in history, profile details and health profile
              you entered, so you can start over. Your account and your clinic medical records are kept.
            </p>

            {!showResetConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="inline-flex items-center space-x-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/30">
                <Trash2 className="w-4 h-4" />
                <span>Reset data</span>
              </button>
            ) : (
              <form onSubmit={handleResetData} className="space-y-3 rounded-lg border border-red-200 bg-red-50/60 p-4 dark:border-red-900/60 dark:bg-red-950/20">
                <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                  This cannot be undone. Enter your current password to confirm.
                </p>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="w-full border border-red-200 dark:border-red-900/60 dark:bg-gray-700 dark:text-white rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Enter current password" required />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={loading}
                    className="inline-flex items-center space-x-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    <span>{loading ? 'Resetting...' : 'Confirm reset'}</span>
                  </button>
                  <button type="button" disabled={loading}
                    onClick={() => { setShowResetConfirm(false); setResetPassword(''); }}
                    className="rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700/50">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      );
    }

    if (id === 'password') {
      return (
        <form onSubmit={handlePasswordChange} className="space-y-4">
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
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                placeholder="Enter current password" required />
              <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600">
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
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                placeholder="Min 8 characters" required />
              <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600">
                {showNewPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={passwordForm.new_password_confirmation}
                onChange={(e) => setPasswordForm({...passwordForm, new_password_confirmation: e.target.value})}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                placeholder="Re-enter new password" required />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-maroon-800 text-white font-semibold rounded-lg hover:bg-maroon-900 transition flex items-center justify-center space-x-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{loading ? 'Saving...' : 'Update Password'}</span>
          </button>
        </form>
      );
    }

    if (id === 'email') {
      return (
        <form onSubmit={handleEmailChange} className="space-y-4">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <Mail className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
            <span>Change Email</span>
          </h3>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5">Current Email</label>
            <input type="email" value={user.email || ''} disabled
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-sm bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5">New Email</label>
            <input type="email" value={emailForm.new_email} onChange={(e) => setEmailForm({...emailForm, new_email: e.target.value})}
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" required />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5">Confirm Password</label>
            <input type="password" value={emailForm.password} onChange={(e) => setEmailForm({...emailForm, password: e.target.value})}
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" required />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-maroon-800 text-white font-semibold rounded-lg hover:bg-maroon-900 transition flex items-center justify-center space-x-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{loading ? 'Saving...' : 'Update Email'}</span>
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
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="font-semibold text-gray-800 dark:text-white mb-1">Medical Records</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Only authorized clinic staff can access your records.</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="font-semibold text-gray-800 dark:text-white mb-1">Data Request</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Contact the clinic administrator to request your data.</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="font-semibold text-gray-800 dark:text-white mb-1">Data Privacy Act</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Your data is protected under RA 10173 (Data Privacy Act of 2012).</p>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      <div className="rounded-lg border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 lg:p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your account</p>
      </div>

      {message && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className={`p-3 rounded-lg text-sm font-medium text-center ${
            messageType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
          {message}
        </motion.div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 lg:p-6">
        <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
          {/* Mobile: accordion — tapping a section slides its panel open beneath it */}
          <div className="space-y-2 md:hidden">
            {tabs.map(tab => {
              const isOpen = activeTab === tab.id;
              return (
                <div key={tab.id} className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
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
                className={`flex w-full items-center gap-3 rounded-lg border-b border-gray-100 px-4 py-3 text-left text-sm font-semibold transition-colors last:border-b-0 dark:border-gray-700 ${
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
      </div>

    </div>
  );
};

export default Settings;
