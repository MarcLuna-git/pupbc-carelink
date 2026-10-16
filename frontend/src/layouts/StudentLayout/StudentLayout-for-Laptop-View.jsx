import { Link } from 'react-router-dom';
import { Bell, Moon, Sun } from 'lucide-react';

import StudentSidebar from './student-shell/StudentSidebar';
import StudentHeaderSearch from './student-shell/StudentHeaderSearch';
import StudentAccountMenu from './student-shell/StudentAccountMenu';
import './StudentLayout-for-Laptop-View.css';

/*
 * Laptop / desktop outer shell for the Student portal (viewport >= 768px).
 *
 * StudentLayout-for-Web-View picks between this shell and the mobile shell with a JS media
 * query, so only one shell is ever mounted. This component owns the
 * laptop-only chrome:
 *   - fixed sidebar (rendered via the shared StudentSidebar, so it also
 *     doubles as the mobile drawer)
 *   - header with page title, search, clinic status, alerts / theme / account
 * The page content is injected through `children`; shared data and handlers
 * are passed down from StudentLayout-for-Web-View so logic is never duplicated.
 *
 * The tablet icon-rail (768-1099px) is handled purely in CSS.
 */
const StudentLayoutForLaptopView = ({
  children,
  user,
  displayName,
  avatar,
  avatarFailed,
  setAvatarFailed,
  navItems,
  isActive,
  unreadCount,
  showClinicStatus,
  darkMode,
  toggleDarkMode,
  query,
  setQuery,
  searchOpen,
  setSearchOpen,
  searchRef,
  profileMenuOpen,
  setProfileMenuOpen,
  profileMenuRef,
  pageTitle,
  onSearchSubmit,
  onLogout,
}) => (
  <>
    <StudentSidebar navItems={navItems} isActive={isActive} />

    <div className="student-shell-body">
      {/* Header */}
      <header className="student-header">
        <div className="student-header-inner">
          <p className="student-header-page">{pageTitle}</p>

          <StudentHeaderSearch
            query={query}
            setQuery={setQuery}
            searchOpen={searchOpen}
            setSearchOpen={setSearchOpen}
            searchRef={searchRef}
            onSubmit={onSearchSubmit}
          />

          {/* Header actions */}
          <div className="student-header-actions">
            <Link
              to="/student/appointments"
              className={`student-clinic-status${showClinicStatus ? '' : ' is-hidden'}`}
              title="Scheduling is confirmed by the clinic. See server-provided availability in the booking calendar."
            >
              <span className="student-clinic-dot" /><span><strong>Clinic schedule</strong><small>See available times</small></span>
            </Link>
            {/* Combined Notifications + Announcements */}
            <Link
              to="/student/alerts"
              aria-label="Open notifications and announcements"
              title="Notifications & Announcements"
              className="student-header-icon student-notification-bell"
            >
              <Bell className="h-5 w-5" />

              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-900">
                  {unreadCount > 99
                    ? '99+'
                    : unreadCount}
                </span>
              )}
            </Link>

            {/* Quick appearance toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label={
                darkMode
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
              }
              title={
                darkMode
                  ? 'Light mode'
                  : 'Dark mode'
              }
              className="student-header-icon student-theme-toggle"
            >
              {darkMode ? (
                <Sun className="h-5 w-5 text-yellow-400" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>

            {/* Account menu */}
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
  </>
);

export default StudentLayoutForLaptopView;
