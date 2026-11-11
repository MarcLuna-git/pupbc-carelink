import useAccountTheme from '../../hooks/useAccountTheme';
import useStudentWidgetPrefs from '../../hooks/useStudentWidgetPrefs';
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  Calendar,
  FileText,
  LogOut,
  QrCode,
  Settings,
  User,
} from 'lucide-react';
import {
  AnimatePresence,
  motion,
} from 'framer-motion';

import authService from '../../services/authService';
import { StudentConfirmModal } from '../../components/StudentFeedback';
import api from '../../services/api';
import { fetchDevTools } from '../../services/devTools';
import { sessionId } from '../../services/session';
import ChatWidget from '../../pages/Student/Chatbot-for-Student-Dashboard/ChatWidget';
import { STUDENT_LOGOUT_REQUEST_EVENT, STUDENT_PRIMARY_LINKS, isStudentNavActive, studentPageTitle } from '../../utils/studentPortalNavigation';

/*
 * Base layout styles first, then the two shells (each imports its own
 * stylesheet). Keeping this order bundles the shell rules after the base
 * rules, matching the original single stylesheet's cascade.
 */
import './StudentLayout-for-Desktop-View.css';
import StudentLayoutForTabletView from './StudentLayout-for-Tablet-View';
import StudentLayoutForMobileView from './StudentLayout-for-Mobile-View-Min-300px';

/*
 * Student portal outer shell / main frame (desktop view).
 *
 * This is the skeleton the routed Student pages live inside. It owns the
 * shared state and behaviour (notifications, theme, logout) and the
 * frame-level overlays (the logout dialog
 * and the clinic assistant). It then embeds ONE of
 * the two view shells, chosen with a JS media query:
 *   - StudentLayout-for-Tablet-View  (>= 768px)
 *   - StudentLayout-for-Mobile-View-Min-300px  (<= 767px)
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

  /*
   * No loading UI anywhere: lazy chunks simply pop in when ready (the
   * Suspense fallback is null) and pages render nothing until their own
   * data fetches finish. No artificial timer, no spinner.
   */

  const unreadRequestPending = useRef(false);

  /*
   * Which shell to render. The frame picks a single shell with a JS media
   * query so only one of them is ever mounted:
   *   - <= 767px : StudentLayout-for-Mobile-View-Min-300px (header + bottom nav)
   *   - >= 768px : StudentLayout-for-Tablet-View (sidebar + header)
   */
  const [isMobileView, setIsMobileView] = useState(getIsMobileView);

  const { darkMode, toggleDarkMode } = useAccountTheme();
  const { prefs: widgetPrefs } = useStudentWidgetPrefs();

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

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
          sessionId('student');

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
   * Logout
   *
   * The account menu's Sign Out (sidebar on tablet / desktop, Settings page
   * on mobile) dispatches STUDENT_LOGOUT_REQUEST_EVENT; it opens the confirm
   * dialog below.
   * ------------------------------------------------
   */

  useEffect(() => {
    const openLogoutConfirm = () => setShowLogoutConfirm(true);
    window.addEventListener(STUDENT_LOGOUT_REQUEST_EVENT, openLogoutConfirm);
    return () => window.removeEventListener(STUDENT_LOGOUT_REQUEST_EVENT, openLogoutConfirm);
  }, []);

  /*
   * Developer Tools → Remove time Guard is kept on the server. Pull it once per
   * visit so the pages' client-side time checks match (e.g. after re-login or
   * on another device).
   */
  useEffect(() => {
    fetchDevTools().catch(() => {});
  }, []);

  const confirmLogout = async () => {
    setLogoutLoading(true);
    await authService.logout('student');

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

  /*
   * The routed page renders once and is shared by both shells. The Profile
   * pages assemble their own hero and cards AFTER their data loads — so
   * during loading the frame simply stays blank.
   */
  const routedPage = (
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
        <Suspense fallback={null}>{children}</Suspense>
      </motion.div>
    </AnimatePresence>
  );

  const pageSlot = (
    <main id="student-main" tabIndex={-1} className="student-main">
      {routedPage}
    </main>
  );

  return (
    <div className="student-portal student-approved-shell min-h-screen text-gray-900 dark:text-gray-100">
      <a href="#student-main" className="student-skip-link">Skip to content</a>

      {isMobileView ? (
        /* ==================================================
            MOBILE SHELL (<= 767px)
            Drawer sidebar, bottom nav, and its own CSS live in
            StudentLayout-for-Mobile-View-Min-300px.
        ================================================== */
        <StudentLayoutForMobileView
          navItems={navItems}
          isActive={isActive}
          unreadCount={unreadCount}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
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
          navItems={navItems}
          isActive={isActive}
          unreadCount={unreadCount}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          pageTitle={pageTitle}
        >
          {pageSlot}
        </StudentLayoutForTabletView>
      )}

      {/* Same popup style as the login notices (icon badge, motion, maroon action). */}
      <StudentConfirmModal
        open={showLogoutConfirm}
        icon={LogOut}
        title="Sign out?"
        message="Are you sure you want to end your student session?"
        confirmLabel="Sign Out"
        busyLabel="Signing out..."
        busy={logoutLoading}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      {/* Clinic assistant. Student portal only; conversation lives in memory.
          Hidden when the student turns it off in Settings → General. */}
      {widgetPrefs.chatWidget && <ChatWidget />}

      {/* No loading UI: lazy chunks load silently and pages render nothing
          until their own data fetches finish. */}
     </div>
  );
};

export default StudentLayoutForDesktopView;
