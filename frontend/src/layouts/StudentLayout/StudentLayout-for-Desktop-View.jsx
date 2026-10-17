import useAccountTheme from '../../hooks/useAccountTheme';
import useStudentWidgetPrefs from '../../hooks/useStudentWidgetPrefs';
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import RouteLoading from '../../components/RouteLoading';
import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  Calendar,
  ChevronRight,
  FileText,
  HelpCircle,
  QrCode,
  Settings,
  User,
} from 'lucide-react';
import {
  AnimatePresence,
  motion,
} from 'framer-motion';

import authService from '../../services/authService';
import api from '../../services/api';
import ChatWidget from '../../pages/Student/Chatbot-for-Student-Dashboard/ChatWidget';
import { StudentPortalSearchContext } from '../../components/StudentPortalSearchContext';
import { STUDENT_PRIMARY_LINKS, isStudentNavActive, studentPageTitle } from '../../utils/studentPortalNavigation';
import {
  getStoredUser,
  getDisplayName,
  getAvatar,
} from '../../utils/studentUser';

/*
 * Base layout styles first, then the two shells (each imports its own
 * stylesheet). Keeping this order bundles the shell rules after the base
 * rules, matching the original single stylesheet's cascade.
 */
import './StudentLayout-for-Desktop-View.css';
import StudentLayoutForTabletView from './StudentLayout-for-Tablet-View';
import StudentLayoutForMobileView from './StudentLayout-for-Mobile-View';

/*
 * Student portal outer shell / main frame (desktop view).
 *
 * This is the skeleton the routed Student pages live inside. It owns the
 * shared state and behaviour (logged-in user, notifications, theme, search,
 * account menu, logout) and the frame-level overlays (the floating help
 * widget, the logout dialog, and the clinic assistant). It then embeds ONE of
 * the two view shells, chosen with a JS media query:
 *   - StudentLayout-for-Tablet-View  (>= 768px)
 *   - StudentLayout-for-Mobile-View  (<= 767px)
 * The routed page is passed to whichever shell is active through `children`.
 */

const MOBILE_QUERY = '(max-width: 767px)';

const getIsMobileView = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(MOBILE_QUERY).matches;
};

const StudentLayoutForDesktopView = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const profileMenuRef = useRef(null);
  const unreadRequestPending = useRef(false);
  const [query, setQuery] = useState('');

  /*
   * Which shell to render. The frame picks a single shell with a JS media
   * query so only one of them is ever mounted:
   *   - <= 767px : StudentLayout-for-Mobile-View (header + bottom nav)
   *   - >= 768px : StudentLayout-for-Tablet-View (sidebar + header)
   */
  const [isMobileView, setIsMobileView] = useState(getIsMobileView);

  const [user, setUser] = useState(
    getStoredUser
  );

  const { darkMode, toggleDarkMode } = useAccountTheme();
  const { prefs: widgetPrefs } = useStudentWidgetPrefs();

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
   * Responsive shell switch
   * ------------------------------------------------
   */

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    const handleChange = (event) => setIsMobileView(event.matches);

    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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
  }, [location.pathname]);

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

  const navIcons = { appointments: Calendar, qr: QrCode, records: FileText, profile: User, settings: Settings };
  const navItems = STUDENT_PRIMARY_LINKS.map(item => ({ ...item, icon: navIcons[item.key] }));
  const isActive = path => isStudentNavActive(location.pathname, path);
  const pageTitle = studentPageTitle(location.pathname);

  const displayName =
    getDisplayName(user);

  const avatar = getAvatar(user);

  /*
   * The page slot is shell-agnostic: both shells render the exact same markup
   * so the routed page is never duplicated.
   */
  const pageSlot = (
    <main id="student-main" tabIndex={-1} className="student-main">
      {isActive('/student/profile') && (
        <nav aria-label="Profile sections" className="student-profile-sections">
          <Link to="/student/profile" aria-current={location.pathname.startsWith('/student/profile') ? 'page' : undefined}>Overview</Link>
          <Link to="/student/health-profile" aria-current={location.pathname === '/student/health-profile' ? 'page' : undefined}>Health Profile</Link>
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
  );

  return (
    <StudentPortalSearchContext.Provider value={{ query, setQuery }}>
    <div className="student-portal student-approved-shell min-h-screen text-gray-900 dark:text-gray-100">
      <a href="#student-main" className="student-skip-link">Skip to content</a>

      {isMobileView ? (
        /* ==================================================
            MOBILE SHELL (<= 767px)
            Drawer sidebar, bottom nav, and its own CSS live in
            StudentLayout-for-Mobile-View.
        ================================================== */
        <StudentLayoutForMobileView
          user={user}
          displayName={displayName}
          avatar={avatar}
          avatarFailed={avatarFailed}
          setAvatarFailed={setAvatarFailed}
          navItems={navItems}
          isActive={isActive}
          unreadCount={unreadCount}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          profileMenuOpen={profileMenuOpen}
          setProfileMenuOpen={setProfileMenuOpen}
          profileMenuRef={profileMenuRef}
          onLogout={handleLogout}
        >
          {pageSlot}
        </StudentLayoutForMobileView>
      ) : (
        /* ==================================================
            TABLET / DESKTOP SHELL (>= 768px)
            Sidebar + header live in StudentLayout-for-Tablet-View.
            The tablet rail (768-1099px) is handled purely by CSS.
        ================================================== */
        <StudentLayoutForTabletView
          query={query}
          setQuery={setQuery}
          user={user}
          displayName={displayName}
          avatar={avatar}
          avatarFailed={avatarFailed}
          setAvatarFailed={setAvatarFailed}
          navItems={navItems}
          isActive={isActive}
          unreadCount={unreadCount}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          profileMenuOpen={profileMenuOpen}
          setProfileMenuOpen={setProfileMenuOpen}
          profileMenuRef={profileMenuRef}
          pageTitle={pageTitle}
          onLogout={handleLogout}
        >
          {pageSlot}
        </StudentLayoutForTabletView>
      )}

      {/* Floating Help widget. Part of the shell, never a page.
          Hidden when the student turns it off in Settings → General. */}
      {widgetPrefs.helpWidget && (
        <Link to="/student/help" className="student-help-widget">
          <HelpCircle className="student-help-widget-icon" aria-hidden="true" />
          <span>
            <strong>Need help?</strong>
            Visit Help &amp; Support for clinic and portal guidance.
          </span>
          <ChevronRight className="student-help-widget-arrow" aria-hidden="true" />
        </Link>
      )}

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

      {/* Clinic assistant. Student portal only; conversation lives in memory.
          Hidden when the student turns it off in Settings → General. */}
      {widgetPrefs.chatWidget && <ChatWidget />}
    </div>
    </StudentPortalSearchContext.Provider>
  );
};

export default StudentLayoutForDesktopView;
