import useAccountTheme from '../hooks/useAccountTheme';
import authService from '../services/authService';
import { Suspense, useState, useEffect } from 'react';
import NursePageSkeleton from '../components/NursePageSkeleton';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Calendar, Users, FileText, Bell, LogOut, QrCode, Settings, Menu, X, Stethoscope, Activity, Sun, Moon, Pill, Megaphone, BookOpen } from 'lucide-react';
import { fetchNurseNotifications } from '../services/nurseNotifications';
import useNurseSync from '../hooks/useNurseSync';
import api from '../services/api';

const AdminLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const { darkMode, toggleDarkMode } = useAccountTheme();

  useNurseSync(['students'], async signal => {
    const { data } = await api.get('/auth/me', { signal });
    if (signal.aborted) return;
    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
  });

  useNurseSync(['notifications', 'medicines'], async () => {
    const response = await fetchNurseNotifications();
    setUnreadNotificationCount(Math.max(0, Number(response.data.unread_count) || 0));
  });

  useEffect(() => {
    let active = true;
    const fetchUnreadCount = async () => {
      try {
        if (document.hidden) return;
        const response = await fetchNurseNotifications();
        if (active && response.data?.success) {
          setUnreadNotificationCount(Math.max(0, Number(response.data.unread_count) || 0));
        }
      } catch (error) {
        console.error('Nurse notification count could not be refreshed.', error);
      }
    };
    fetchUnreadCount();
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = () => setShowLogoutConfirm(true);

  const confirmLogout = async () => {
    setLogoutLoading(true);
    await authService.logout();
    navigate('/carelink-portal');
  };

  const navItems = [
    { path: '/nurse/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/nurse/appointments', icon: Calendar, label: 'Appointments' },
    { path: '/nurse/students', icon: Users, label: 'Students' },
    { path: '/nurse/academic', icon: BookOpen, label: 'Courses' },
    { path: '/nurse/consultation', icon: Stethoscope, label: 'Consultation' },
    { path: '/nurse/medicines', icon: Pill, label: 'Medicines' },
    { path: '/nurse/announcements', icon: Megaphone, label: 'Announcements' },
    { path: '/nurse/records', icon: FileText, label: 'Records' },
    { path: '/nurse/notifications', icon: Bell, label: 'Notifications' },
    { path: '/nurse/settings', icon: Settings, label: 'Settings' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-[#F8F9FB] dark:bg-gray-900 dark:text-gray-100 flex flex-col transition-colors duration-300">

      <div className="hidden lg:flex">
        <aside className={`w-64 flex flex-col fixed inset-y-0 left-0 z-40 h-dvh shadow-2xl transition-all duration-300 ${
          darkMode
            ? 'bg-gradient-to-b from-gray-800 to-gray-900 shadow-black/30'
            : 'bg-gradient-to-b from-maroon-800 to-maroon-900 shadow-maroon-900/30'
        }`}>

          <div className={`h-16 flex items-center px-5 border-b transition-colors ${
            darkMode ? 'border-white/5' : 'border-white/10'
          }`}>
            <Link to="/nurse/dashboard" className="flex items-center space-x-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                darkMode ? 'bg-white/10' : 'bg-white/20'
              }`}>
                <Stethoscope className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className={`font-bold text-base transition-colors ${
                  darkMode ? 'text-white/90' : 'text-white'
                }`}>CareLink</span>
                <p className="text-[10px] text-yellow-300/80">Nurse Portal</p>
              </div>
            </Link>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map(item => (
              <Link key={item.path} to={item.path}
                className={`flex items-center space-x-3 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 ${
                  isActive(item.path)
                    ? darkMode
                      ? 'bg-white/10 text-white shadow-lg'
                      : 'bg-white/20 text-white shadow-lg'
                    : darkMode
                      ? 'text-gray-400 hover:bg-white/5 hover:text-white'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}>
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
                {item.path === '/nurse/notifications' && unreadNotificationCount > 0 && (
                  <span className="ml-auto min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          <div className={`p-3 border-t transition-colors ${
            darkMode ? 'border-white/5' : 'border-white/10'
          }`}>
            <div className="flex items-center space-x-3 px-4 py-2 mb-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                darkMode ? 'bg-white/10' : 'bg-white/20'
              }`}>
                <span className="text-white font-bold text-sm">{user.first_name?.[0]}{user.last_name?.[0]}</span>
              </div>
              <span className={`text-sm transition-colors ${
                darkMode ? 'text-white/60' : 'text-white/80'
              }`}>{user.first_name} {user.last_name}</span>
            </div>
            <button onClick={handleLogout}
              className={`flex items-center space-x-3 px-4 py-2.5 rounded-2xl text-sm transition-all w-full ${
                darkMode
                  ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                  : 'text-white/60 hover:text-red-200 hover:bg-red-500/10'
              }`}>
              <LogOut className="w-5 h-5" /><span>Sign Out</span>
            </button>
          </div>
        </aside>
      </div>

      <div className="min-w-0 flex-1 flex flex-col min-h-screen lg:ml-64">

        <header className="h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 px-3 sm:px-4 lg:px-6 sticky top-0 z-30">
          <button aria-label="Open navigation" className="shrink-0 rounded-lg p-2 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>

          <span className="min-w-0 flex-1 truncate text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100">Welcome, Nurse {user.first_name}</span>

          <div className="flex shrink-0 items-center space-x-1">
            <Link to="/nurse/notifications" className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition relative">
              <Bell className="w-5 h-5" />
              {unreadNotificationCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[9px] font-bold leading-4 text-white">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>}
            </Link>
            <button aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={darkMode} onClick={toggleDarkMode} className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
              {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-3 sm:p-4 lg:p-6 overflow-x-auto">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <Suspense fallback={<NursePageSkeleton label="Loading page" />}>{children}</Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {sidebarOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed lg:hidden inset-y-0 left-0 z-50 w-64 max-w-[85vw] flex flex-col h-dvh transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${
        darkMode
          ? 'bg-gradient-to-b from-gray-800 to-gray-900'
          : 'bg-gradient-to-b from-maroon-800 to-maroon-900'
      }`}>
        <div className={`h-16 flex items-center justify-between px-5 border-b ${darkMode ? 'border-white/5' : 'border-white/10'}`}>
          <span className={`font-bold ${darkMode ? 'text-white/90' : 'text-white'}`}>CareLink</span>
          <button onClick={() => setSidebarOpen(false)}><X className="w-5 h-5 text-white" /></button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
              className={`flex items-center space-x-3 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all ${
                isActive(item.path)
                  ? darkMode ? 'bg-white/10 text-white' : 'bg-white/20 text-white'
                  : darkMode ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}>
              <item.icon className="w-5 h-5" /><span>{item.label}</span>
              {item.path === '/nurse/notifications' && unreadNotificationCount > 0 && (
                <span className="ml-auto min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className={`p-3 border-t ${darkMode ? 'border-white/5' : 'border-white/10'}`}>
          <button onClick={handleLogout}
            className={`flex items-center space-x-3 px-4 py-2.5 rounded-2xl text-sm w-full ${
              darkMode ? 'text-gray-400 hover:text-red-400' : 'text-white/60 hover:text-red-200'
            }`}>
            <LogOut className="w-5 h-5" /><span>Sign Out</span>
          </button>
        </div>
      </aside>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="nurse-logout-title" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <h2 id="nurse-logout-title" className="text-lg font-bold text-gray-900 dark:text-white">Sign out?</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Are you sure you want to end your nurse session?</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setShowLogoutConfirm(false)} disabled={logoutLoading} className="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200">Cancel</button>
              <button type="button" onClick={confirmLogout} disabled={logoutLoading} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{logoutLoading ? 'Signing out...' : 'Sign Out'}</button>
            </div>
          </section>
        </div>
      )}

    </div>
  );
};

export default AdminLayout;
