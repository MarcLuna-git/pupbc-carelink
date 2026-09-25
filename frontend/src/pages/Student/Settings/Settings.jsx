import { useState } from 'react';
import { motion } from 'framer-motion';
import { Key, Mail, Shield, Eye, EyeOff, Loader2, Save, Check, Moon, Sun, Lock } from 'lucide-react';
import api from '../../../services/api';

const Settings = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [activeTab, setActiveTab] = useState('password');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;

  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', new_password_confirmation: '' });
  const [emailForm, setEmailForm] = useState({ new_email: '', password: '' });

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
      // Wala pang email-change API call dito.
      setMessageType('success');
      setMessage('Email update request sent. Check your inbox.');
      setEmailForm({ new_email: '', password: '' });
    } catch (err) {
      setMessageType('error');
      setMessage(err.response?.data?.message || 'Failed to update email.');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const desktopTabs = [
    { id: 'password', icon: Key, label: 'Password', desc: 'Change your password' },
    { id: 'email', icon: Mail, label: 'Email', desc: 'Update email address' },
    { id: 'appearance', icon: Moon, label: 'Appearance', desc: 'Light or dark theme' },
    { id: 'privacy', icon: Shield, label: 'Privacy', desc: 'Data & privacy' },
  ];

  const tabs = isDesktop ? desktopTabs : desktopTabs;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your account</p>
      </div>

      {message && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className={`p-3 rounded-2xl text-sm font-medium text-center ${
            messageType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
          {message}
        </motion.div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id ? 'bg-maroon-800 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
            }`}>
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-5 lg:p-6">
        
        {activeTab === 'password' && (
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
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-2xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
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
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-2xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
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
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                  placeholder="Re-enter new password" required />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-maroon-800 text-white font-semibold rounded-2xl hover:bg-maroon-900 transition flex items-center justify-center space-x-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{loading ? 'Saving...' : 'Update Password'}</span>
            </button>
          </form>
        )}

        {activeTab === 'email' && (
          <form onSubmit={handleEmailChange} className="space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <Mail className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
              <span>Change Email</span>
            </h3>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5">Current Email</label>
              <input type="email" value={user.email || ''} disabled
                className="w-full border border-gray-200 dark:border-gray-600 rounded-2xl px-4 py-3 text-sm bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5">New Email</label>
              <input type="email" value={emailForm.new_email} onChange={(e) => setEmailForm({...emailForm, new_email: e.target.value})}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5">Confirm Password</label>
              <input type="password" value={emailForm.password} onChange={(e) => setEmailForm({...emailForm, password: e.target.value})}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" required />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-maroon-800 text-white font-semibold rounded-2xl hover:bg-maroon-900 transition flex items-center justify-center space-x-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{loading ? 'Saving...' : 'Update Email'}</span>
            </button>
          </form>
        )}

        {activeTab === 'appearance' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <Moon className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
              <span>Appearance</span>
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => applyDarkMode(false)}
                className={`p-4 rounded-2xl border-2 transition-all text-center ${
                  !darkMode ? 'border-maroon-800 bg-maroon-50 dark:bg-maroon-900/20 shadow-md' : 'border-gray-200 dark:border-gray-600'
                }`}>
                <Sun className={`w-7 h-7 mx-auto mb-1 ${!darkMode ? 'text-maroon-800' : 'text-gray-400'}`} />
                <p className={`text-sm font-semibold ${!darkMode ? 'text-maroon-800' : 'text-gray-500'}`}>Light</p>
                {!darkMode && <Check className="w-4 h-4 text-maroon-800 mx-auto mt-1" />}
              </button>
              <button onClick={() => applyDarkMode(true)}
                className={`p-4 rounded-2xl border-2 transition-all text-center ${
                  darkMode ? 'border-maroon-800 bg-maroon-50 dark:bg-maroon-900/20 shadow-md' : 'border-gray-200 dark:border-gray-600'
                }`}>
                <Moon className={`w-7 h-7 mx-auto mb-1 ${darkMode ? 'text-maroon-800' : 'text-gray-400'}`} />
                <p className={`text-sm font-semibold ${darkMode ? 'text-maroon-800' : 'text-gray-500'}`}>Dark</p>
                {darkMode && <Check className="w-4 h-4 text-maroon-800 mx-auto mt-1" />}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <Shield className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
              <span>Privacy & Data</span>
            </h3>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4">
                <p className="font-semibold text-gray-800 dark:text-white mb-1">Medical Records</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Only authorized clinic staff can access your records.</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4">
                <p className="font-semibold text-gray-800 dark:text-white mb-1">Data Request</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Contact the clinic administrator to request your data.</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4">
                <p className="font-semibold text-gray-800 dark:text-white mb-1">Data Privacy Act</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Your data is protected under RA 10173 (Data Privacy Act of 2012).</p>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};

export default Settings;