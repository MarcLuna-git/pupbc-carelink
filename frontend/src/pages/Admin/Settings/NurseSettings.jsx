import { useState, useEffect } from 'react';
import { Key, Lock, Save, Loader2, Eye, EyeOff, User, Mail, Shield, Bell, Building, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../../../services/api';
import authService from '../../../services/authService';

const NurseSettings = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [loading, setLoading] = useState(false);
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  
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
      const token = localStorage.getItem('token');
      await api.post('/nurse/change-password', {
        email: user.email,
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
        new_password_confirmation: passwordForm.new_password_confirmation,
      }, {
        headers: { Authorization: `Bearer ${token}` }
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
    setLoading(true);
    setMessage('');
    
    try {
      const token = localStorage.getItem('token');
      await api.put('/nurse/profile', profile, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const updatedUser = { ...user, ...profile };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      setMessageType('success');
      setMessage('Profile updated successfully!');
    } catch (err) {
      setMessageType('error');
      setMessage(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      window.location.href = '/carelink-portal';
    } catch (err) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/carelink-portal';
    }
  };

  const inputClass = "w-full border border-gray-200 dark:border-gray-600 rounded-2xl px-4 py-2.5 text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-maroon-500 focus:outline-none";
  const labelClass = "text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5";

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your account and preferences</p>
      </div>

      {message && (
        <div className={`p-3 rounded-2xl text-sm text-center flex items-center justify-center space-x-2 ${
          messageType === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
        }`}>
          {messageType === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{message}</span>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center space-x-2 mb-4">
          <User className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
          <span>Profile Information</span>
        </h3>
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>First Name</label>
              <input 
                className={inputClass}
                type="text" 
                value={profile.first_name} 
                onChange={(e) => setProfile({...profile, first_name: e.target.value})} 
                placeholder="First Name" 
              />
            </div>
            <div>
              <label className={labelClass}>Last Name</label>
              <input 
                className={inputClass}
                type="text" 
                value={profile.last_name} 
                onChange={(e) => setProfile({...profile, last_name: e.target.value})} 
                placeholder="Last Name" 
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                className={`${inputClass} pl-10 bg-gray-50 dark:bg-gray-600 cursor-not-allowed`}
                type="email" 
                value={profile.email} 
                disabled 
                title="Email cannot be changed"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed. Contact the clinic for changes.</p>
          </div>
          <button type="submit" disabled={loading} 
            className="px-6 py-2.5 bg-maroon-800 text-white rounded-xl font-semibold text-sm flex items-center space-x-2 hover:bg-maroon-900 transition disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Update Profile</span>
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center space-x-2 mb-4">
          <Key className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
          <span>Change Password</span>
        </h3>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className={labelClass}>Current Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                className={`${inputClass} pl-10 pr-12`}
                type={showCurrentPass ? 'text' : 'password'}
                value={passwordForm.current_password} 
                onChange={(e) => setPasswordForm({...passwordForm, current_password: e.target.value})} 
                placeholder="Enter current password"
                required 
              />
              <button type="button" onClick={() => setShowCurrentPass(!showCurrentPass)} 
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                {showCurrentPass ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className={labelClass}>New Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                className={`${inputClass} pl-10 pr-12`}
                type={showNewPass ? 'text' : 'password'}
                value={passwordForm.new_password} 
                onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})} 
                placeholder="Enter new password (min 8 chars)"
                required 
              />
              <button type="button" onClick={() => setShowNewPass(!showNewPass)} 
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                {showNewPass ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            {passwordForm.new_password && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
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
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                className={`${inputClass} pl-10 ${
                  passwordForm.new_password_confirmation && passwordForm.new_password === passwordForm.new_password_confirmation 
                    ? 'border-green-400 bg-green-50 dark:bg-green-900/10' 
                    : passwordForm.new_password_confirmation && passwordForm.new_password !== passwordForm.new_password_confirmation 
                    ? 'border-red-400 bg-red-50 dark:bg-red-900/10' 
                    : 'border-gray-200 dark:border-gray-600'
                }`}
                type="password"
                value={passwordForm.new_password_confirmation} 
                onChange={(e) => setPasswordForm({...passwordForm, new_password_confirmation: e.target.value})} 
                placeholder="Re-enter new password"
                required 
              />
            </div>
            {passwordForm.new_password_confirmation && passwordForm.new_password === passwordForm.new_password_confirmation && (
              <p className="text-green-600 text-xs mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Passwords match</p>
            )}
            {passwordForm.new_password_confirmation && passwordForm.new_password !== passwordForm.new_password_confirmation && (
              <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
            )}
          </div>

          <button type="submit" disabled={loading} 
            className="w-full py-3 bg-maroon-800 text-white rounded-2xl font-semibold flex items-center justify-center space-x-2 hover:bg-maroon-900 transition disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Update Password</span>
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center space-x-2 mb-4">
          <Bell className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
          <span>Notification Preferences</span>
        </h3>
        <div className="space-y-3">
          {[
            { key: 'email_notifications', label: 'Email Notifications', desc: 'Receive email notifications' },
            { key: 'appointment_alerts', label: 'Appointment Alerts', desc: 'Get notified for new appointments' },
            { key: 'new_registration_alerts', label: 'Registration Alerts', desc: 'Get notified for new student registrations' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{item.label}</p>
                <p className="text-xs text-gray-400">{item.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={notifPrefs[item.key]} 
                  onChange={(e) => setNotifPrefs({...notifPrefs, [item.key]: e.target.checked})}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-maroon-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-maroon-800"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center space-x-2 mb-4">
          <Building className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
          <span>System Information</span>
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-500">Version</span>
            <span className="font-medium text-gray-700 dark:text-gray-200">{systemInfo.version}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-500">Last Updated</span>
            <span className="font-medium text-gray-700 dark:text-gray-200">{systemInfo.lastUpdated}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-500">Environment</span>
            <span className="font-medium text-gray-700 dark:text-gray-200">{systemInfo.environment}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Logged in as</span>
            <span className="font-medium text-maroon-700 dark:text-maroon-400 capitalize">{user.role || 'Nurse'}</span>
          </div>
        </div>
      </div>

      <button 
        onClick={handleLogout}
        className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-2xl font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 transition flex items-center justify-center space-x-2"
      >
        <Shield className="w-4 h-4" />
        <span>Sign Out</span>
      </button>

      <p className="text-center text-xs text-gray-400 pb-8">
        PUPBC CareLink v{systemInfo.version} • PUP Biñan Campus Clinic
      </p>
    </div>
  );
};

export default NurseSettings;