import { Suspense, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import { getUser, onSessionChange, setUser as saveSessionUser } from '../../services/session';
import useAccountTheme from '../../hooks/useAccountTheme';
import useNurseSync from '../../hooks/useNurseSync';
import authService from '../../services/authService';
import api from '../../services/api';
import { fetchNurseNotifications } from '../../services/nurseNotifications';
import { fetchNurseDevTools } from '../../services/devTools';
import NursePageSkeleton from '../../components/NursePageSkeleton';
import { NURSE_NAV_ITEMS, isNurseNavActive } from './nurse-shell/nurseNavigation';
import { nurseBreadcrumbFor } from '../../utils/nurseGreeting';

/*
 * Base styles first, then the two shells (each imports its own stylesheet),
 * so the shell rules come after the base rules in the bundle.
 */
import './NurseLayout-for-Desktop-View.css';
import NurseLayoutForTabletView from './NurseLayout-for-Tablet-View';
import NurseLayoutForMobileView from './NurseLayout-for-Mobile-View';

/*
 * Nurse portal outer shell / main frame.
 *
 * Owns the shared state (user, unread count, theme, sign-out confirm) and
 * mounts ONE of the two view shells, chosen with a JS media query:
 *   - NurseLayout-for-Tablet-View  (>= 768px; desktop and laptop included)
 *   - NurseLayout-for-Mobile-View  (<= 767px)
 * The routed page is passed to whichever shell is active through `children`.
 */
const MOBILE_QUERY = '(max-width: 767px)';

const getIsMobileView = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(MOBILE_QUERY).matches;
};

const NurseLayoutForDesktopView = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileView, setIsMobileView] = useState(getIsMobileView);
  const [user, setUser] = useState(() => getUser('nurse'));
  const [unreadCount, setUnreadCount] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const { darkMode, toggleDarkMode } = useAccountTheme();

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    const handleChange = (event) => setIsMobileView(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useNurseSync(['students'], async (signal) => {
    const { data } = await api.get('/auth/me', { signal });
    if (signal.aborted) return;
    // While a duty change is still saving, keep the status the nurse just chose.
    const latest = dutyInFlight.current || dutyTarget.current !== null
      ? { ...data.user, on_duty: userRef.current?.on_duty }
      : data.user;
    setUser(latest);
    saveSessionUser(latest, 'nurse');
  });

  // Settings saves the user to the in-memory session; follow it.
  useEffect(() => onSessionChange((portal) => {
    if (portal === 'nurse') setUser(getUser('nurse'));
  }), []);

  useEffect(() => {
    setUser(getUser('nurse'));
  }, [location.pathname]);

  useNurseSync(['notifications', 'medicines'], async () => {
    const response = await fetchNurseNotifications();
    setUnreadCount(Math.max(0, Number(response.data.unread_count) || 0));
  });

  // Live counts shown as badges on the Management links (Appointments, Queue, Consultation).
  const [navCounts, setNavCounts] = useState({});
  const loadNavCounts = async (signal) => {
    const { data } = await api.get('/nurse/nav-counts', { signal });
    if (!signal?.aborted && data?.success) setNavCounts(data.data || {});
  };
  useNurseSync(['appointments', 'queue', 'consultations'], loadNavCounts);
  useEffect(() => {
    const controller = new AbortController();
    loadNavCounts(controller.signal).catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let active = true;
    const fetchUnreadCount = async () => {
      try {
        if (document.hidden) return;
        const response = await fetchNurseNotifications();
        if (active && response.data?.success) {
          setUnreadCount(Math.max(0, Number(response.data.unread_count) || 0));
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

  // Developer Tools → Remove time Guard lives on the server; mirror it once per visit.
  // A slow server can time the first read out, so try again a few times before giving up.
  useEffect(() => {
    let timer;
    let cancelled = false;
    const load = (attempt) => {
      fetchNurseDevTools().catch(() => {
        if (!cancelled && attempt < 4) timer = setTimeout(() => load(attempt + 1), 5000 * attempt);
      });
    };
    load(1);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  const confirmLogout = async () => {
    setLogoutLoading(true);
    await authService.logout('nurse');
    navigate('/carelink-portal');
  };

  const isActive = (path) => isNurseNavActive(location.pathname, path);

  // On duty / Off duty, saved on the server so every device shows the same status.
  // The switch never locks: the newest choice shows (and is stored) at once,
  // and only the latest one is sent once any earlier save has finished.
  const [dutySaving, setDutySaving] = useState(false);
  const userRef = useRef(user);
  userRef.current = user;
  const dutyTarget = useRef(null);
  const dutyInFlight = useRef(false);

  const applyUser = (next) => {
    userRef.current = next;
    setUser(next);
    saveSessionUser(next, 'nurse');
  };

  const flushDuty = async () => {
    if (dutyInFlight.current) return;
    dutyInFlight.current = true;
    setDutySaving(true);
    try {
      while (dutyTarget.current !== null) {
        const target = dutyTarget.current;
        dutyTarget.current = null;
        try {
          const { data } = await api.patch('/nurse/duty-status', { on_duty: target });
          if (dutyTarget.current === null) applyUser(data.data);
        } catch (error) {
          console.error('Duty status could not be saved.', error);
          if (dutyTarget.current === null) {
            // Show what the server really has instead of a guess.
            const { data } = await api.get('/auth/me').catch(() => ({ data: null }));
            if (data?.user) applyUser(data.user);
          }
        }
      }
    } finally {
      dutyInFlight.current = false;
      setDutySaving(false);
    }
  };

  const toggleDuty = () => {
    const current = userRef.current;
    if (!current) return;
    const next = current.on_duty === false;
    applyUser({ ...current, on_duty: next });
    dutyTarget.current = next;
    flushDuty();
  };

  const accountMenuProps = {
    user,
    darkMode,
    toggleDarkMode,
    onToggleDuty: toggleDuty,
    dutySaving,
    onSignOut: () => setShowLogoutConfirm(true),
  };

  const shellProps = {
    navItems: NURSE_NAV_ITEMS.map((item) => (item.countKey
      ? { ...item, count: Math.max(0, Number(navCounts[item.countKey]) || 0) }
      : item)),
    isActive,
    unreadCount,
    onUnreadCount: setUnreadCount,
    darkMode,
    toggleDarkMode,
    accountMenuProps,
    // The header bar shows the breadcrumb; each page's title is in its own hero (NursePageTitle).
    breadcrumb: nurseBreadcrumbFor(location.pathname),
  };

  const pageSlot = (
    <main id="nurse-main" tabIndex={-1} className="nurse-main">
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16 }}
          className="nurse-page-content"
        >
          <Suspense fallback={<NursePageSkeleton label="Loading page" />}>{children}</Suspense>
        </motion.div>
      </AnimatePresence>
    </main>
  );

  return (
    <div className="nurse-shell">
      <a href="#nurse-main" className="nurse-skip-link">Skip to content</a>

      {isMobileView ? (
        <NurseLayoutForMobileView {...shellProps}>{pageSlot}</NurseLayoutForMobileView>
      ) : (
        <NurseLayoutForTabletView {...shellProps}>
          {pageSlot}
        </NurseLayoutForTabletView>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="nurse-logout-title" className="w-full max-w-sm rounded-[10px] bg-white p-6 shadow-2xl dark:bg-gray-800">
            <h2 id="nurse-logout-title" className="text-lg font-bold text-gray-900 dark:text-white">Sign out?</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Are you sure you want to end your nurse session?</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setShowLogoutConfirm(false)} disabled={logoutLoading} className="flex-1 rounded-[10px] bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200">Cancel</button>
              <button type="button" onClick={confirmLogout} disabled={logoutLoading} className="flex-1 rounded-[10px] bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{logoutLoading ? 'Signing out...' : 'Sign Out'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default NurseLayoutForDesktopView;
