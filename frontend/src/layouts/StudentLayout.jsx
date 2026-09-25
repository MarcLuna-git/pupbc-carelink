import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  Bell,
  Calendar,
  ChevronRight,
  FileText,
  HelpCircle,
  Info,
  LogOut,
  Moon,
  Palette,
  QrCode,
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
import clinicLogo from '../assets/clinic logo.jpg';

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

  const [user, setUser] = useState(
    getStoredUser
  );

  const [darkMode, setDarkMode] = useState(
    () =>
      localStorage.getItem('darkMode') ===
      'true'
  );

  const [
    profileMenuOpen,
    setProfileMenuOpen,
  ] = useState(false);

  const [greeting, setGreeting] =
    useState('');

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

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

  useEffect(() => {
    const savedMode =
      localStorage.getItem('darkMode') ===
      'true';

    setDarkMode(savedMode);

    document.documentElement.classList.toggle(
      'dark',
      savedMode
    );
  }, []);

  useEffect(() => {
    const handleDarkModeChange = () => {
      const isDark =
        localStorage.getItem('darkMode') ===
        'true';

      setDarkMode(isDark);

      document.documentElement.classList.toggle(
        'dark',
        isDark
      );
    };

    window.addEventListener(
      'darkModeChange',
      handleDarkModeChange
    );

    return () => {
      window.removeEventListener(
        'darkModeChange',
        handleDarkModeChange
      );
    };
  }, []);

  const toggleDarkMode = () => {
    const nextMode = !darkMode;

    setDarkMode(nextMode);

    localStorage.setItem(
      'darkMode',
      String(nextMode)
    );

    document.documentElement.classList.toggle(
      'dark',
      nextMode
    );

    window.dispatchEvent(
      new Event('darkModeChange')
    );
  };

  /*
   * ------------------------------------------------
   * Greeting
   * ------------------------------------------------
   */

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();

      if (hour < 12) {
        setGreeting('Good morning');
      } else if (hour < 18) {
        setGreeting('Good afternoon');
      } else {
        setGreeting('Good evening');
      }
    };

    updateGreeting();

    const interval = window.setInterval(
      updateGreeting,
      60000
    );

    return () =>
      window.clearInterval(interval);
  }, []);

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
  }, [location.pathname]);

  /*
   * ------------------------------------------------
   * Logout
   * ------------------------------------------------
   */

  const handleLogout = async () => {
    setProfileMenuOpen(false);

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

  const desktopNavItems = [
    {
      path: '/student/appointments',
      icon: Calendar,
      label: 'Appointments',
    },
    {
      path: '/student/qr',
      icon: QrCode,
      label: 'My QR Code',
    },
    {
      path: '/student/health-records',
      icon: FileText,
      label: 'Health Records',
    },
  ];

  const mobileNavItems = [
    {
      path: '/student/appointments',
      icon: Calendar,
      label: 'Appointments',
    },
    {
      path: '/student/qr',
      icon: QrCode,
      label: 'QR',
    },
    {
      path: '/student/health-records',
      icon: FileText,
      label: 'Records',
    },
    {
      path: '/student/profile',
      icon: User,
      label: 'Profile',
    },
  ];

  const isActive = (path) => {
    if (path === '/student/profile') {
      return (
        location.pathname ===
          '/student/profile' ||
        location.pathname.startsWith(
          '/student/profile/'
        ) ||
        location.pathname.startsWith(
          '/student/settings'
        ) ||
        location.pathname.startsWith(
          '/student/help'
        ) ||
        location.pathname.startsWith(
          '/student/about'
        )
      );
    }

    return (
      location.pathname === path ||
      location.pathname.startsWith(
        `${path}/`
      )
    );
  };

  const displayName =
    getDisplayName(user);

  const avatar = getAvatar(user);

  const studentMeta = [
    user?.course ||
      user?.profile?.course,
    user?.student_id,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-gray-900 transition-colors duration-300 dark:bg-gray-950 dark:text-gray-100">
      {/* ==================================================
          DESKTOP SIDEBAR
      ================================================== */}

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-hidden border-r border-maroon-950/10 bg-gradient-to-b from-[#65111f] via-[#751426] to-[#4f0d18] shadow-2xl shadow-black/10 lg:flex">
        {/* Brand */}
        <div className="border-b border-white/10 px-5 py-5">
          <Link
            to="/student/appointments"
            className="flex items-center gap-3"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white p-1 shadow-lg">
              <img
                src={clinicLogo}
                alt="PUPBC CareLink clinic logo"
                className="h-full w-full object-contain"
              />
            </div>

            <div className="min-w-0">
              <p className="truncate text-base font-bold leading-tight text-white">
                PUPBC CareLink
              </p>

              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                Student Portal
              </p>
            </div>
          </Link>
        </div>

        {/* Main links */}
        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-6">
          <p className="px-4 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
            Clinic Services
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
                  className={`group relative flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all duration-200 ${
                    active
                      ? 'bg-white text-maroon-900 shadow-lg shadow-black/10'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon
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

      </aside>

      {/* ==================================================
          MAIN AREA
      ================================================== */}

      <div className="flex min-h-screen flex-col lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/95 shadow-sm shadow-black/[0.02] backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/95">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-5 lg:px-7">
            {/* Mobile brand */}
            <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white p-0.5 dark:border-gray-700">
                <img
                  src={clinicLogo}
                  alt="PUPBC CareLink clinic logo"
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-tight text-maroon-900 dark:text-maroon-200">
                  PUPBC CareLink
                </p>

                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                  Student Portal
                </p>
              </div>
            </div>

            {/* Desktop greeting */}
            <div className="hidden min-w-0 lg:flex lg:items-center lg:gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-maroon-50 px-2.5 py-1 dark:bg-maroon-950/35">
                  <span className="h-1.5 w-1.5 rounded-full bg-maroon-700 dark:bg-maroon-300" />

                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-maroon-800 dark:text-maroon-300">
                    {greeting}
                  </p>
                </div>

                <p className="mt-1 truncate text-sm font-semibold text-gray-950 dark:text-white">
                  {displayName}
                </p>

                {studentMeta && (
                  <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
                    {studentMeta}
                  </p>
                )}
              </div>
            </div>

            {/* Header actions */}
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              {/* Combined Notifications + Announcements */}
              <Link
                to="/student/alerts"
                aria-label="Open notifications and announcements"
                title="Notifications & Announcements"
                className="relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 transition-all hover:bg-maroon-50 hover:text-maroon-800 focus:outline-none focus:ring-2 focus:ring-maroon-500/30 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-maroon-300"
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
                className="hidden h-10 w-10 items-center justify-center rounded-xl text-gray-600 transition-all hover:bg-gray-100 hover:text-maroon-800 focus:outline-none focus:ring-2 focus:ring-maroon-500/30 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-yellow-300 sm:flex"
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
                  className={`ml-0.5 flex h-10 w-10 items-center justify-center rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-maroon-500/30 ${
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
                      className="absolute right-0 top-[calc(100%+0.6rem)] w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-black/15 dark:border-gray-700 dark:bg-gray-900"
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

        <main className="flex-1 px-3 py-4 pb-28 sm:px-5 sm:py-5 lg:px-7 lg:py-6 lg:pb-8">
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
              className="mx-auto w-full max-w-[1600px]"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ==================================================
          MOBILE / TABLET BOTTOM NAVIGATION
      ================================================== */}

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_25px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/95 lg:hidden">
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
    </div>
  );
};

export default StudentLayout;