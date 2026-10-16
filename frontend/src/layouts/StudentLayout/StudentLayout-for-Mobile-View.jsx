import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, Menu, Moon, Search, Sun } from 'lucide-react';

import StudentSidebar from './student-shell/StudentSidebar';
import StudentHeaderSearch from './student-shell/StudentHeaderSearch';
import StudentAccountMenu from './student-shell/StudentAccountMenu';
import './StudentLayout-for-Mobile-View.css';

/*
 * Mobile outer shell for the Student portal (viewport <= 767px).
 *
 * StudentLayout-for-Web-View picks between this shell and the desktop/laptop shell with a
 * JS media query, so only one shell is ever mounted. This component owns the
 * mobile-only chrome:
 *   - slide-in drawer sidebar + backdrop (state lives here)
 *   - header with the hamburger, page title, search, alerts / theme / account
 *   - bottom tab bar
 * The page content is injected through `children`; shared data and handlers
 * are passed down from StudentLayout-for-Web-View so the two shells never duplicate logic.
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
}) => {
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  const closeNav = () => setNavOpen(false);

  /* Close the drawer whenever the route changes. */
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  /* Close the drawer with the Escape key. */
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setNavOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  /* Lock page scroll while the drawer is open. */
  useEffect(() => {
    if (!navOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [navOpen]);

  return (
    <>
      <StudentSidebar
        navItems={navItems}
        isActive={isActive}
        isOpen={navOpen}
        onNavigate={closeNav}
        onClose={closeNav}
      />

      <button
        type="button"
        aria-label="Close navigation"
        tabIndex={navOpen ? 0 : -1}
        className={`student-sidebar-backdrop ${navOpen ? 'is-open' : ''}`}
        onClick={closeNav}
      />

      <div className="student-shell-body">
        <header className="student-header">
          <div className="student-header-inner">
            <button
              type="button"
              className="student-mobile-menu"
              aria-label="Open navigation"
              aria-expanded={navOpen}
              aria-controls="student-sidebar"
              onClick={() => setNavOpen(true)}
            >
              <Menu aria-hidden="true" />
            </button>

            <p className="student-header-page">{pageTitle}</p>

            <StudentHeaderSearch
              query={query}
              setQuery={setQuery}
              searchOpen={searchOpen}
              setSearchOpen={setSearchOpen}
              searchRef={searchRef}
              onSubmit={onSearchSubmit}
            />

            <div className="student-header-actions">
              <button
                type="button"
                className="student-mobile-search"
                aria-label="Open appointment search"
                aria-expanded={searchOpen}
                onClick={() => {
                  setSearchOpen((value) => !value);
                  requestAnimationFrame(() => searchRef.current?.focus());
                }}
              >
                <Search />
              </button>

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
