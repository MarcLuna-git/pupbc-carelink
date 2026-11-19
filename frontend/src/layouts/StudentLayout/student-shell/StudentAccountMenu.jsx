import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  HelpCircle,
  Info,
  LogOut,
  Moon,
  Palette,
  Settings,
  Sun,
} from 'lucide-react';

import { getAvatar, getCourseSection, getDisplayName, getInitials, getStoredUser } from '../../../utils/studentUser';
import { preloadForPath } from '../../../utils/preloadStudentPages';
import { STUDENT_LOGOUT_REQUEST_EVENT } from '../../../utils/studentPortalNavigation';
import { onSessionChange } from '../../../services/session';
import { darkModeKey, readDarkMode as readPortalDarkMode, saveDarkMode } from '../../../hooks/useAccountTheme';

/*
 * User account button + dropdown.
 *
 * Lives at the foot of the sidebar (tablet / desktop, opens upward) and in
 * the mobile header (avatar only, opens downward). Self-contained: it reads the
 * stored user, follows profile / theme updates, and asks the portal frame to
 * confirm Sign Out via STUDENT_LOGOUT_REQUEST_EVENT.
 *
 * The dropdown is portaled to <body> with fixed positioning measured from the
 * button, because the sidebar clips overflow (and folds to a 76px rail).
 */
const MENU_WIDTH = 288;
const GAP = 8;
const EDGE = 12;

const readDarkMode = () => readPortalDarkMode('student');

const StudentAccountMenu = ({ variant = 'sidebar', collapsed = false }) => {
  const location = useLocation();
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const [user, setUser] = useState(getStoredUser);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [darkMode, setDarkMode] = useState(readDarkMode);

  const displayName = getDisplayName(user);
  const avatar = getAvatar(user);
  const course = getCourseSection(user);
  const opensUp = variant === 'sidebar';

  // Keep the name / avatar / theme label in sync with the rest of the portal.
  useEffect(() => {
    const refreshUser = () => {
      setUser(getStoredUser());
      setAvatarFailed(false);
    };
    // The theme is saved per device; follow changes made in another tab.
    const onStorage = (event) => {
      if (event.key === darkModeKey('student') || event.key === null) setDarkMode(readDarkMode());
    };
    // The signed-in user lives in memory (services/session.js); follow its updates.
    const stopSession = onSessionChange((portal) => {
      if (portal === 'student') refreshUser();
    });
    const onTheme = () => setDarkMode(readDarkMode());

    window.addEventListener('studentProfileUpdated', refreshUser);
    window.addEventListener('carelink:student-user-updated', refreshUser);
    window.addEventListener('darkModeChange', onTheme);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('studentProfileUpdated', refreshUser);
      window.removeEventListener('carelink:student-user-updated', refreshUser);
      window.removeEventListener('darkModeChange', onTheme);
      window.removeEventListener('storage', onStorage);
      stopSession();
    };
  }, []);

  // Close on navigation.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Place the dropdown next to the button (above it in the sidebar).
  useLayoutEffect(() => {
    if (!open) return undefined;

    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(MENU_WIDTH, window.innerWidth - EDGE * 2);
      // Sidebar: grow rightward from the button; header: right-aligned to it.
      const anchor = opensUp ? rect.left : rect.right - width;
      const left = Math.min(Math.max(EDGE, anchor), window.innerWidth - width - EDGE);
      setPosition(
        opensUp
          ? { left, width, bottom: window.innerHeight - rect.top + GAP }
          : { left, width, top: rect.bottom + GAP }
      );
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, opensUp]);

  // Outside click / Escape closes it.
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (buttonRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Same mechanism as useAccountTheme's toggle; the frame's hook picks up
  // the event and applies the class.
  const toggleDarkMode = () => {
    const next = !readDarkMode();
    saveDarkMode(next, 'student');
    window.dispatchEvent(new Event('darkModeChange'));
    setDarkMode(next);
  };

  // Picking a destination always folds the dropdown — even when it's the
  // page already open (no route change, so the pathname effect won't fire).
  const closeMenu = () => setOpen(false);

  const signOut = () => {
    setOpen(false);
    window.dispatchEvent(new Event(STUDENT_LOGOUT_REQUEST_EVENT));
  };

  const renderAvatar = (size) => (
    <span className={`student-account-avatar ${size}`}>
      {avatar && !avatarFailed ? (
        <img src={avatar} alt="" onError={() => setAvatarFailed(true)} />
      ) : (
        getInitials(user)
      )}
    </span>
  );

  const itemClass =
    'flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800';
  const iconBox =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gray-100 dark:bg-gray-800';

  const menu = (
    <AnimatePresence>
      {open && position && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: opensUp ? 8 : -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: opensUp ? 6 : -6, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          role="menu"
          aria-label="Account menu"
          style={{ position: 'fixed', ...position }}
          className="student-account-menu z-[90] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-[10px] border border-gray-200 bg-white shadow-2xl shadow-black/15 dark:border-gray-700 dark:bg-gray-900"
        >
          {/* Account summary */}
          <div className="border-b border-gray-100 bg-gradient-to-br from-maroon-50 to-white p-4 dark:border-gray-800 dark:from-maroon-950/30 dark:to-gray-900">
            <div className="flex items-center gap-3">
              {renderAvatar('is-large')}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-950 dark:text-white">{displayName}</p>
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                  {user?.student_id || 'Student Account'}
                </p>
                {course && (
                  <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">{course}</p>
                )}
              </div>
            </div>
          </div>

          <div className="p-2">
            <Link
              to="/student/settings"
              role="menuitem"
              onClick={closeMenu}
              onMouseEnter={() => preloadForPath('/student/settings')}
              onFocus={() => preloadForPath('/student/settings')}
              className={itemClass}
            >
              <span className={iconBox}><Settings className="h-4 w-4" /></span>
              <span>
                <span className="block font-semibold">Settings</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">Manage account preferences</span>
              </span>
            </Link>

            {/* Appearance: the row itself is static; only the switch acts. */}
            <div className="mt-1 flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200">
              <span className={iconBox}><Palette className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span id="student-appearance-label" className="block font-semibold">Appearance</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {darkMode ? 'Dark mode is on' : 'Light mode is on'}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={darkMode}
                aria-labelledby="student-appearance-label"
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                onClick={toggleDarkMode}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-600 ${
                  darkMode ? 'bg-maroon-800' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform ${
                    darkMode ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                >
                  {darkMode ? (
                    <Moon className="h-3 w-3 text-maroon-800" />
                  ) : (
                    <Sun className="h-3 w-3 text-amber-500" />
                  )}
                </span>
              </button>
            </div>

            <div className="my-2 border-t border-gray-100 dark:border-gray-800" />

            <Link to="/student/help" role="menuitem" onClick={closeMenu} className={itemClass}>
              <HelpCircle className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Help &amp; Support</span>
            </Link>

            <Link to="/student/about" role="menuitem" onClick={closeMenu} className={`mt-1 ${itemClass}`}>
              <Info className="h-4 w-4 text-gray-500" />
              <span className="font-medium">About CareLink</span>
            </Link>

            <div className="my-2 border-t border-gray-100 dark:border-gray-800" />

            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm font-semibold text-maroon-800 transition-colors hover:bg-maroon-50 dark:text-maroon-300 dark:hover:bg-maroon-900/30"
            >
              <LogOut className="h-4 w-4" />
              <span>
                <span className="block">Sign Out</span>
                <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">End your current session</span>
              </span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${displayName}`}
        title={collapsed ? displayName : undefined}
        className={`student-account-button is-${variant}${open ? ' is-open' : ''}`}
      >
        {renderAvatar('is-small')}
        <span className="student-account-caption">
          <strong>{displayName}</strong>
          <small>{course || 'Student account'}</small>
        </span>
      </button>

      {createPortal(menu, document.body)}
    </>
  );
};

export default StudentAccountMenu;
