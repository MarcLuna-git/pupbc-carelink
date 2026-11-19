import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HeartPulse, Moon, Sun } from 'lucide-react';

import StudentAccountMenu from './student-shell/StudentAccountMenu';
import StudentNotificationsMenu from './student-shell/StudentNotificationsMenu';
import { preloadForPath } from '../../utils/preloadStudentPages';
import './StudentLayout-for-Mobile-View-Min-300px.css';

/*
 * Mobile outer shell for the Student portal (viewport 300px – 767px).
 *
 * StudentLayout-for-Desktop-View picks between this shell and the desktop/tablet shell with a
 * JS media query, so only one shell is ever mounted. This component owns the
 * mobile-only chrome:
 *   - header with the page title, alerts / theme / account menu
 *   - bottom tab bar
 * There is no drawer sidebar on mobile — navigation happens through the
 * bottom dock; Settings, Help, About and Sign Out are in the account menu. Page content is injected through `children`; shared data and
 * handlers are passed down from StudentLayout-for-Desktop-View so the two shells
 * never duplicate logic.
 */
const StudentLayoutForMobileView = ({
  children,
  navItems,
  isActive,
  unreadCount,
  darkMode,
  toggleDarkMode,
}) => {
  return (
    <>
      <div className="student-shell-body" data-route-scroll>
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
              <StudentNotificationsMenu unreadCount={unreadCount} />

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

              {/* User account (avatar only on mobile): the same dropdown as
                  the desktop sidebar — Settings, Appearance, Help, About,
                  Sign Out. */}
              <StudentAccountMenu variant="header" />
            </div>
          </div>
        </header>

        {children}
      </div>

      <nav aria-label="Mobile student navigation" className="student-bottom-nav">
        {/* Settings stays out of the dock on mobile — it's reached through the
            account menu in the header. */}
        <div className="mx-auto grid max-w-xl grid-cols-4 px-1.5 py-1.5">
          {navItems.filter((item) => item.key !== 'settings').map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                onMouseEnter={() => preloadForPath(item.path)}
                onFocus={() => preloadForPath(item.path)}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-[10px] px-1 transition-all ${
                  active
                    ? 'text-maroon-800 dark:text-white'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="student-mobile-active-tab"
                    className="absolute inset-1 rounded-[10px] bg-maroon-50 dark:bg-white/10"
                    transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                  />
                )}

                <Icon className="relative z-10 h-5 w-5" />

                <span className="student-bottom-nav-label relative z-10 max-w-full truncate text-xs font-semibold leading-none sm:text-xs">
                  {item.shortLabel || item.label}
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
