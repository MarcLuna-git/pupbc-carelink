import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, HeartPulse, Moon, Sun } from 'lucide-react';

import StudentAccountMenu from './student-shell/StudentAccountMenu';
import './StudentLayout-for-Mobile-View.css';

/*
 * Mobile outer shell for the Student portal (viewport <= 767px).
 *
 * StudentLayout-for-Desktop-View picks between this shell and the desktop/tablet shell with a
 * JS media query, so only one shell is ever mounted. This component owns the
 * mobile-only chrome:
 *   - header with the page title, search, alerts / theme / account
 *   - bottom tab bar
 * There is no drawer sidebar on mobile — navigation happens through the
 * bottom dock. Page content is injected through `children`; shared data and
 * handlers are passed down from StudentLayout-for-Desktop-View so the two shells
 * never duplicate logic.
 */
const StudentLayoutForMobileView = ({
  children,
  user,
  displayName,
  avatar,
  avatarFailed,
  setAvatarFailed,
  navItems,
  isActive,
  unreadCount,
  darkMode,
  toggleDarkMode,
  profileMenuOpen,
  setProfileMenuOpen,
  profileMenuRef,
  onLogout,
}) => {
  return (
    <>
      <div className="student-shell-body">
        <header className="student-header">
          <div className="student-header-inner">
            <div className="student-header-brand">
              <HeartPulse className="student-header-brand-symbol" aria-hidden="true" />
              <span className="min-w-0">
                <span className="student-header-brand-name">CareLink</span>
                <span className="student-header-brand-caption">Student Portal</span>
              </span>
            </div>

            <div className="student-header-actions">
              <Link
                to="/student/alerts"
                aria-label="Open notifications and announcements"
                title="Notifications & Announcements"
                className="student-header-icon student-notification-bell"
              >
                <Bell className="h-5 w-5" />

                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-900">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>

              <button
                type="button"
                onClick={toggleDarkMode}
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                title={darkMode ? 'Light mode' : 'Dark mode'}
                className="student-header-icon student-theme-toggle"
              >
                {darkMode ? (
                  <Sun className="h-5 w-5 text-yellow-400" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </button>

              <StudentAccountMenu
                user={user}
                displayName={displayName}
                avatar={avatar}
                avatarFailed={avatarFailed}
                setAvatarFailed={setAvatarFailed}
                profileMenuOpen={profileMenuOpen}
                setProfileMenuOpen={setProfileMenuOpen}
                profileMenuRef={profileMenuRef}
                darkMode={darkMode}
                toggleDarkMode={toggleDarkMode}
                onLogout={onLogout}
              />
            </div>
          </div>
        </header>

        {children}
      </div>

      <nav aria-label="Mobile student navigation" className="student-bottom-nav">
        <div className="mx-auto grid max-w-xl grid-cols-5 px-1.5 py-1.5">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-1 transition-all ${
                  active
                    ? 'text-maroon-800 dark:text-maroon-300'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="student-mobile-active-tab"
                    className="absolute inset-1 rounded-xl bg-maroon-50 dark:bg-maroon-950/35"
                    transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                  />
                )}

                <Icon className="relative z-10 h-5 w-5" />

                <span className="relative z-10 max-w-full truncate text-[10px] font-semibold leading-none sm:text-[11px]">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default StudentLayoutForMobileView;
