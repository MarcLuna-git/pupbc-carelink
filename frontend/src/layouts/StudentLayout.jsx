import useAccountTheme from '../hooks/useAccountTheme';
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import RouteLoading from '../components/RouteLoading';
import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  Bell,
  Calendar,
  ClipboardPlus,
  ChevronRight,
  FileText,
  HelpCircle,
  HeartPulse,
  Info,
  LogOut,
  Moon,
  Palette,
  QrCode,
  Search,
  Settings,
  Sun,
  User,
} from 'lucide-react';
import {
  AnimatePresence,
  motion,
} from 'framer-motion';

import authService from '../services/authService';
import api from '../services/api';
import ChatWidget from '../components/chatbot/ChatWidget';
import { StudentPortalSearchContext } from '../components/StudentPortalSearchContext';
import { STUDENT_PRIMARY_LINKS, isStudentNavActive, studentPageTitle } from '../utils/studentPortalNavigation';
import '../student-portal.css';
import campusBackground from '../assets/pup-binan-hero.jpg';

const getStoredUser = () => {
  try {
    return JSON.parse(
      localStorage.getItem('user') || '{}'
    );
  } catch {
    return {};
  }
};

const getAvatar = (user) =>
  user?.profile?.profile_picture ||
  user?.profile_picture ||
  user?.avatar_url ||
  '';

const getDisplayName = (user) => {
  const name = [
    user?.first_name,
    user?.middle_name,
    user?.last_name,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return name || 'Student';
};

const getInitials = (user) => {
  const first = String(
    user?.first_name || ''
  ).trim();

  const last = String(
    user?.last_name || ''
  ).trim();

  const initials = `${first.charAt(0)}${last.charAt(
    0
  )}`.trim();

  return initials.toUpperCase() || 'S';
};

const StudentLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const profileMenuRef = useRef(null);
  const unreadRequestPending = useRef(false);
  const searchRef = useRef(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const [user, setUser] = useState(
    getStoredUser
  );

  const { darkMode, toggleDarkMode } = useAccountTheme();

  const [
    profileMenuOpen,
    setProfileMenuOpen,
  ] = useState(false);


  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const [
    avatarFailed,
    setAvatarFailed,
  ] = useState(false);

  /*
   * ------------------------------------------------
   * User / profile synchronization
   * ------------------------------------------------
   */

  const refreshStoredUser =
    useCallback(() => {
      const latestUser =
        getStoredUser();

      setUser(latestUser);
      setAvatarFailed(false);
    }, []);

  useEffect(() => {
    const handleProfileUpdated = () => {
      refreshStoredUser();
    };

    const handleStorage = (event) => {
      if (
        event.key === 'user' ||
        event.key === null
      ) {
        refreshStoredUser();
      }
    };

    window.addEventListener(
      'studentProfileUpdated',
      handleProfileUpdated
    );

    window.addEventListener(
      'storage',
      handleStorage
    );

    return () => {
      window.removeEventListener(
        'studentProfileUpdated',
        handleProfileUpdated
      );

      window.removeEventListener(
        'storage',
        handleStorage
      );
    };
  }, [refreshStoredUser]);

  /*
   * ------------------------------------------------
   * Appearance
   * ------------------------------------------------
   */

  /*
   * ------------------------------------------------
   * Greeting
   * ------------------------------------------------
   */

  /*
   * ------------------------------------------------
   * Notifications / alerts
   *
   * Poll every 10 seconds so Student approval,
   * clinic alerts, and other notification changes
   * become visible without manual refresh.
   * ------------------------------------------------
   */

  const fetchUnreadCount =
    useCallback(async () => {
      if (document.hidden || unreadRequestPending.current) return;
      unreadRequestPending.current = true;
      try {
        const token =
          localStorage.getItem('token');

        if (!token) {
          setUnreadCount(0);
          return;
        }

        const response = await api.get(
          '/student/notifications',
          {
            params: {
              limit: 1,
            },
          }
        );

        if (response.data?.success) {
          setUnreadCount(
            Math.max(
              0,
              Number(
                response.data.unread_count
              ) || 0
            )
          );
        }
      } catch {
        /*
         * Notification refresh should never block
         * the Student portal.
         */
      } finally {
        unreadRequestPending.current = false;
      }
    }, []);

  useEffect(() => {
    fetchUnreadCount();

    const interval =
      window.setInterval(
        fetchUnreadCount,
        10000
      );

    const handleNotificationsUpdated = (
      event
    ) => {
      const nextCount = Number(
        event?.detail?.unreadCount
      );

      if (Number.isFinite(nextCount)) {
        setUnreadCount(
          Math.max(0, nextCount)
        );
      } else {
        fetchUnreadCount();
      }
    };

    const handleFocus = () => {
      fetchUnreadCount();
    };

    const handleVisibilityChange = () => {
      if (
        document.visibilityState ===
        'visible'
      ) {
        fetchUnreadCount();
      }
    };

    window.addEventListener(
      'carelink:notifications-updated',
      handleNotificationsUpdated
    );

    window.addEventListener(
      'focus',
      handleFocus
    );

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    return () => {
      window.clearInterval(interval);

      window.removeEventListener(
        'carelink:notifications-updated',
        handleNotificationsUpdated
      );

      window.removeEventListener(
        'focus',
        handleFocus
      );

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );
    };
  }, [fetchUnreadCount]);

  /*
   * ------------------------------------------------
   * Profile menu
   * ------------------------------------------------
   */

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(
          event.target
        )
      ) {
        setProfileMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener(
      'mousedown',
      handleOutsideClick
    );

    document.addEventListener(
      'keydown',
      handleEscape
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick
      );

      document.removeEventListener(
        'keydown',
        handleEscape
      );
    };
  }, []);

  useEffect(() => {
    setProfileMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const shortcut = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => searchRef.current?.focus());
      }
      if (event.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, []);

  /*
   * ------------------------------------------------
   * Logout
   * ------------------------------------------------
   */

  const handleLogout = () => {
    setProfileMenuOpen(false);
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setLogoutLoading(true);
    await authService.logout();

    document.documentElement.classList.remove(
      'dark'
    );

    navigate('/login', {
      replace: true,
    });
  };

  /*
   * ------------------------------------------------
   * Navigation
   * ------------------------------------------------
   */

  const navIcons = { appointments: Calendar, qr: QrCode, records: FileText, profile: User };
  const desktopNavItems = STUDENT_PRIMARY_LINKS.map(item => ({ ...item, icon: navIcons[item.key] }));
  const mobileNavItems = desktopNavItems;
  const isActive = path => isStudentNavActive(location.pathname, path);

  const displayName =
    getDisplayName(user);

  const avatar = getAvatar(user);

  return (
    <StudentPortalSearchContext.Provider value={{ query, setQuery }}>
    <div className="student-portal student-approved-shell min-h-screen text-gray-900 dark:text-gray-100">
      <a href="#student-main" className="student-skip-link">Skip to content</a>
      {/* ==================================================
          DESKTOP SIDEBAR
      ================================================== */}

      <aside className="student-sidebar">
        <img src={campusBackground} alt="" aria-hidden="true" loading="lazy" className="student-sidebar-campus" />
        {/* Brand */}
        <div className="student-sidebar-brand">
          <Link
            to="/student/appointments"
            className="flex items-center gap-3"
          >
            <HeartPulse className="student-brand-symbol" aria-hidden="true" />

            <div className="min-w-0">
              <p className="truncate text-base font-bold leading-tight text-white">
                CareLink
              </p>

              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">
                Student Portal
              </p>
            </div>
          </Link>
        </div>

        {/* Main links */}
        <nav aria-label="Primary student navigation" className="student-sidebar-nav">
          <p className="px-4 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
            Main Menu
          </p>

          {desktopNavItems.map(
            (item) => {
              const active = isActive(
                item.path
              );

              const Icon =
                item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  title={item.label}
                  className={`group relative flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all duration-200 ${
                    active
                      ? 'bg-white text-maroon-900 shadow-lg shadow-black/10'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon
                    aria-hidden="true"
                    className={`h-5 w-5 shrink-0 ${
                      active
                        ? 'text-maroon-800'
                        : 'text-white/75'
                    }`}
                  />

                  <span className="flex-1">
                    {item.label}
                  </span>

                  {active && (
                    <ChevronRight className="h-4 w-4 text-maroon-700" />
                  )}
                </Link>
              );
            }
          )}
        </nav>
        <div className="student-sidebar-tagline">
          Your Health. Our Care.<br />A Healthier PUPBC Community.
        </div>
      </aside>

      {/* ==================================================
          MAIN AREA
      ================================================== */}

      <div className="student-shell-body">
        {/* Header */}
        <header className="student-header">
          <div className="student-header-inner">
            <p className="student-header-page">{studentPageTitle(location.pathname)}</p>
            <form className={`student-header-search ${searchOpen ? 'is-open' : ''}`} onSubmit={event => {
              event.preventDefault();
              setSearchOpen(false);
              navigate('/student/appointments');
            }} role="search">
              <Search aria-hidden="true" />
              <input ref={searchRef} type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label="Search appointments" placeholder="Search services or appointments…" />
              <kbd>Ctrl K</kbd>
              <button type="button" className="student-search-close" onClick={() => setSearchOpen(false)} aria-label="Close search">×</button>
            </form>
            {/* Header actions */}
            <div className="student-header-actions">
              <button type="button" className="student-mobile-search" aria-label="Open appointment search" aria-expanded={searchOpen} onClick={() => {
                setSearchOpen(value => !value);
                requestAnimationFrame(() => searchRef.current?.focus());
              }}><Search /></button>
              <Link to="/student/appointments" className="student-clinic-status" title="Scheduling is confirmed by the clinic. See server-provided availability in the booking calendar.">
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
              <div
                ref={profileMenuRef}
                className="relative"
              >
                <button
                  type="button"
                  onClick={() =>
                    setProfileMenuOpen(
                      (current) =>
                        !current
                    )
                  }
                  aria-expanded={
                    profileMenuOpen
                  }
                  aria-haspopup="menu"
                  aria-label="Open account menu"
                  title={displayName}
                  className={`student-account-button ${
                    profileMenuOpen
                      ? 'border-maroon-200 bg-maroon-50 dark:border-maroon-800 dark:bg-maroon-950/35'
                      : 'border-transparent hover:border-gray-200 hover:bg-gray-50 dark:hover:border-gray-700 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-maroon-100 text-xs font-bold text-maroon-800 ring-1 ring-maroon-200 dark:bg-maroon-950 dark:text-maroon-200 dark:ring-maroon-800">
                    {avatar &&
                    !avatarFailed ? (
                      <img
                        src={avatar}
                        alt={`${displayName} profile`}
                        className="h-full w-full object-cover"
                        onError={() =>
                          setAvatarFailed(
                            true
                          )
                        }
                      />
                    ) : (
                      getInitials(user)
                    )}
                  </div>
                  <span className="student-account-caption"><strong>{displayName}</strong><small>{user?.course || user?.profile?.course || 'Student account'}</small></span>
                </button>

                <AnimatePresence>
                  {profileMenuOpen && (
                    <motion.div
                      initial={{
                        opacity: 0,
                        y: -8,
                        scale: 0.98,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                      }}
                      exit={{
                        opacity: 0,
                        y: -6,
                        scale: 0.98,
                      }}
                      transition={{
                        duration: 0.15,
                      }}
                      role="menu"
                      className="student-account-menu absolute right-0 top-[calc(100%+0.6rem)] w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-black/15 dark:border-gray-700 dark:bg-gray-900"
                    >
                      {/* Account summary */}
                      <div className="border-b border-gray-100 bg-gradient-to-br from-maroon-50 to-white p-4 dark:border-gray-800 dark:from-maroon-950/30 dark:to-gray-900">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-maroon-100 text-sm font-bold text-maroon-800 ring-2 ring-white shadow-sm dark:bg-maroon-950 dark:text-maroon-200 dark:ring-gray-800">
                            {avatar &&
                            !avatarFailed ? (
                              <img
                                src={avatar}
                                alt=""
                                className="h-full w-full object-cover"
                                onError={() =>
                                  setAvatarFailed(
                                    true
                                  )
                                }
                              />
                            ) : (
                              getInitials(
                                user
                              )
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-gray-950 dark:text-white">
                              {displayName}
                            </p>

                            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                              {user?.student_id ||
                                'Student Account'}
                            </p>

                            {(user?.course ||
                              user?.profile
                                ?.course) && (
                              <p className="mt-0.5 truncate text-[11px] text-gray-400 dark:text-gray-500">
                                {user?.course ||
                                  user
                                    ?.profile
                                    ?.course}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Menu */}
                      <div className="p-2">
                        <Link
                          to="/student/profile"
                          role="menuitem"
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                            <User className="h-4 w-4" />
                          </div>

                          <div>
                            <p className="font-semibold">
                              Profile
                            </p>

                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              View and edit your information
                            </p>
                          </div>
                        </Link>

                        <Link to="/student/health-profile" role="menuitem" className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">
                          <ClipboardPlus className="h-5 w-5" /><span>Health Profile</span>
                        </Link>
                        <Link
                          to="/student/settings"
                          role="menuitem"
                          className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                            <Settings className="h-4 w-4" />
                          </div>

                          <div>
                            <p className="font-semibold">
                              Settings
                            </p>

                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              Manage account preferences
                            </p>
                          </div>
                        </Link>

                        <button
                          type="button"
                          onClick={
                            toggleDarkMode
                          }
                          role="menuitem"
                          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                            <Palette className="h-4 w-4" />
                          </div>

                          <div className="flex-1">
                            <p className="font-semibold">
                              Appearance
                            </p>

                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              {darkMode
                                ? 'Dark mode is on'
                                : 'Light mode is on'}
                            </p>
                          </div>

                          {darkMode ? (
                            <Moon className="h-4 w-4 text-maroon-700 dark:text-maroon-300" />
                          ) : (
                            <Sun className="h-4 w-4 text-amber-500" />
                          )}
                        </button>

                        <div className="my-2 border-t border-gray-100 dark:border-gray-800" />

                        <Link
                          to="/student/help"
                          role="menuitem"
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          <HelpCircle className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">
                            Help & Support
                          </span>
                        </Link>

                        <Link
                          to="/student/about"
                          role="menuitem"
                          className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          <Info className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">
                            About CareLink
                          </span>
                        </Link>

                        <div className="my-2 border-t border-gray-100 dark:border-gray-800" />

                        <button
                          type="button"
                          onClick={
                            handleLogout
                          }
                          role="menuitem"
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          <LogOut className="h-4 w-4" />

                          <div>
                            <p>Sign Out</p>

                            <p className="text-[11px] font-normal text-red-500/70 dark:text-red-400/70">
                              End your current session
                            </p>
                          </div>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* ==================================================
            PAGE CONTENT
        ================================================== */}

        <main id="student-main" tabIndex={-1} className="student-main">
          {isActive('/student/profile') && (
            <nav aria-label="Profile sections" className="student-profile-sections">
              <Link to="/student/profile" aria-current={location.pathname.startsWith('/student/profile') ? 'page' : undefined}>Overview</Link>
              <Link to="/student/health-profile" aria-current={location.pathname === '/student/health-profile' ? 'page' : undefined}>Health Profile</Link>
              <Link to="/student/settings" aria-current={location.pathname.startsWith('/student/settings') ? 'page' : undefined}>Settings</Link>
            </nav>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{
                opacity: 0,
                y: 6,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: -4,
              }}
              transition={{
                duration: 0.16,
              }}
              className="student-page-content"
            >
              <Suspense fallback={<RouteLoading />}>{children}</Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
        <footer className="student-assistant-dock">
          <Link to="/student/help"><HelpCircle /><span><strong>Need help?</strong> Visit Help & Support for clinic and portal guidance.</span><ChevronRight /></Link>
        </footer>
      </div>

      {/* ==================================================
          MOBILE / TABLET BOTTOM NAVIGATION
      ================================================== */}

      <nav aria-label="Mobile student navigation" className="student-bottom-nav">
        <div className="mx-auto grid max-w-xl grid-cols-4 px-1.5 py-1.5">
          {mobileNavItems.map(
            (item) => {
              const active = isActive(
                item.path
              );

              const Icon =
                item.icon;

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
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 34,
                      }}
                    />
                  )}

                  <Icon className="relative z-10 h-5 w-5" />

                  <span className="relative z-10 max-w-full truncate text-[10px] font-semibold leading-none sm:text-[11px]">
                    {item.label}
                  </span>
                </Link>
              );
            }
          )}
        </div>
      </nav>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="student-logout-title" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <h2 id="student-logout-title" className="text-lg font-bold text-gray-900 dark:text-white">Sign out?</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Are you sure you want to end your student session?</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setShowLogoutConfirm(false)} disabled={logoutLoading} className="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200">Cancel</button>
              <button type="button" onClick={confirmLogout} disabled={logoutLoading} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{logoutLoading ? 'Signing out...' : 'Sign Out'}</button>
            </div>
          </section>
        </div>
      )}

      {/* Clinic assistant. Student portal only; conversation lives in memory. */}
      <ChatWidget />
    </div>
    </StudentPortalSearchContext.Provider>
  );
};

export default StudentLayout;
