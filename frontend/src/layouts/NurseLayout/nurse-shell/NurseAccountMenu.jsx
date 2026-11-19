import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BriefcaseMedical, LogOut, Moon, Palette, PenLine, Settings, Sun } from 'lucide-react';

import { getAvatar } from '../../../utils/studentUser';
import { currentSignatory } from '../../../services/documentSignatory';
import { nurseDisplayName, nurseInitials } from './nurseNavigation';
import NurseSignatoryDialog from './NurseSignatoryDialog';

/*
 * Nurse account button + dropdown.
 *
 * Lives at the foot of the sidebar (tablet / desktop, opens upward) and in
 * the mobile header (avatar only, opens downward). The frame owns the user,
 * theme and sign-out confirm; this component only presents them.
 *
 * The dropdown is portaled to <body> with fixed positioning measured from the
 * button, because the sidebar clips overflow (and folds to a 76px rail).
 */
const MENU_WIDTH = 288;
const GAP = 8;
const EDGE = 12;

const NurseAccountMenu = ({
  variant = 'sidebar',
  collapsed = false,
  user,
  darkMode,
  toggleDarkMode,
  onToggleDuty,
  dutySaving = false,
  onSignOut,
}) => {
  const location = useLocation();
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [showSignatory, setShowSignatory] = useState(false);

  const displayName = nurseDisplayName(user);
  const avatar = getAvatar(user);
  const opensUp = variant === 'sidebar';
  // Older sessions have no flag yet: treat them as on duty (the server default).
  const onDuty = user?.on_duty !== false;
  const dutyLabel = onDuty ? 'On duty' : 'Off duty';

  useEffect(() => setAvatarFailed(false), [avatar]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(MENU_WIDTH, window.innerWidth - EDGE * 2);
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

  const closeMenu = () => setOpen(false);
  const closeSignatory = useCallback(() => setShowSignatory(false), []);
  // Read when the menu draws, so it shows the latest pick after the dialog closes.
  const signatory = open ? currentSignatory(user) : null;

  const signOut = () => {
    setOpen(false);
    onSignOut?.();
  };

  const renderAvatar = (size) => (
    <span className={`nurse-account-avatar ${size}`}>
      {size === 'is-small' && <span className={`nurse-avatar-duty ${onDuty ? 'is-on' : ''}`} aria-hidden="true" />}
      {avatar && !avatarFailed ? (
        <img src={avatar} alt="" onError={() => setAvatarFailed(true)} />
      ) : (
        nurseInitials(user)
      )}
    </span>
  );

  const itemClass =
    'flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/60';
  const iconBox =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gray-100 dark:bg-gray-700';

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
          className="z-[90] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-[10px] border border-gray-100 bg-white shadow-2xl shadow-black/15 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="border-b border-gray-100 p-4 dark:border-gray-700">
            <div className="flex items-center gap-3">
              {renderAvatar('is-large')}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900 dark:text-white">Nurse {displayName}</p>
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{user?.email || 'Nurse account'}</p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400"><span className={`h-2 w-2 rounded-full ${onDuty ? 'bg-green-500' : 'bg-gray-400'}`} />{dutyLabel} · PUP Biñan Campus Clinic</p>
              </div>
            </div>
          </div>

          <div className="p-2">
            <Link to="/nurse/settings" role="menuitem" onClick={closeMenu} className={itemClass}>
              <span className={iconBox}><Settings className="h-4 w-4" /></span>
              <span>
                <span className="block font-semibold">Settings</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">Manage account preferences</span>
              </span>
            </Link>

            <button type="button" role="menuitem" onClick={() => { setOpen(false); setShowSignatory(true); }} className={`mt-1 ${itemClass}`}>
              <span className={iconBox}><PenLine className="h-4 w-4" /></span>
              <span className="min-w-0">
                <span className="block font-semibold">Document signatory</span>
                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                  {signatory ? `Signing as ${signatory.name}` : 'Usual signatory on each document'}
                </span>
              </span>
            </button>

            <div className="mt-1 flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200">
              <span className={iconBox}><BriefcaseMedical className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span id="nurse-duty-label" className="block font-semibold">Duty status</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {onDuty ? 'You are on duty' : 'You are off duty'}{dutySaving && ' · Saving…'}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={onDuty}
                aria-labelledby="nurse-duty-label"
                title={onDuty ? 'Switch to off duty' : 'Switch to on duty'}
                onClick={onToggleDuty}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  onDuty ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${onDuty ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="mt-1 flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200">
              <span className={iconBox}><Palette className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span id="nurse-appearance-label" className="block font-semibold">Appearance</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {darkMode ? 'Dark mode is on' : 'Light mode is on'}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={darkMode}
                aria-labelledby="nurse-appearance-label"
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                onClick={toggleDarkMode}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  darkMode ? 'bg-maroon-800' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform ${
                    darkMode ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                >
                  {darkMode ? <Moon className="h-3 w-3 text-maroon-800" /> : <Sun className="h-3 w-3 text-yellow-500" />}
                </span>
              </button>
            </div>

            <div className="my-2 border-t border-gray-100 dark:border-gray-700" />

            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              <span>
                <span className="block">Sign Out</span>
                <span className="block text-xs font-normal text-red-500/70 dark:text-red-400/70">End your nurse session</span>
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
        aria-label={`Account menu for ${displayName}, ${dutyLabel}`}
        title={collapsed ? displayName : undefined}
        className={`nurse-account-button is-${variant}${open ? ' is-open' : ''}`}
      >
        {renderAvatar('is-small')}
        <span className="nurse-account-caption">
          <strong>{displayName}</strong>
          <small>{dutyLabel}</small>
        </span>
      </button>

      {createPortal(menu, document.body)}
      {showSignatory && <NurseSignatoryDialog user={user} onClose={closeSignatory} />}
    </>
  );
};

export default NurseAccountMenu;
