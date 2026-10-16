import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ClipboardPlus,
  HelpCircle,
  Info,
  LogOut,
  Moon,
  Palette,
  Settings,
  Sun,
  User,
} from 'lucide-react';

import { getInitials } from '../../../utils/studentUser';

/*
 * Account button + dropdown.
 *
 * Shared by the desktop header and the mobile header, so the menu markup is
 * defined once. The root keeps `className="relative"` (instead of a wrapper)
 * because the header CSS targets `.student-header-actions > .relative` for
 * ordering.
 */
const StudentAccountMenu = ({
  user,
  displayName,
  avatar,
  avatarFailed,
  setAvatarFailed,
  profileMenuOpen,
  setProfileMenuOpen,
  profileMenuRef,
  darkMode,
  toggleDarkMode,
  onLogout,
}) => (
  <div ref={profileMenuRef} className="relative">
    <button
      type="button"
      onClick={() => setProfileMenuOpen((current) => !current)}
      aria-expanded={profileMenuOpen}
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
        {avatar && !avatarFailed ? (
          <img
            src={avatar}
            alt={`${displayName} profile`}
            className="h-full w-full object-cover"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          getInitials(user)
        )}
      </div>

      <span className="student-account-caption">
        <strong>{displayName}</strong>
        <small>{user?.course || user?.profile?.course || 'Student account'}</small>
      </span>
    </button>

    <AnimatePresence>
      {profileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          role="menu"
          className="student-account-menu absolute right-0 top-[calc(100%+0.6rem)] w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-black/15 dark:border-gray-700 dark:bg-gray-900"
        >
          {/* Account summary */}
          <div className="border-b border-gray-100 bg-gradient-to-br from-maroon-50 to-white p-4 dark:border-gray-800 dark:from-maroon-950/30 dark:to-gray-900">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-maroon-100 text-sm font-bold text-maroon-800 ring-2 ring-white shadow-sm dark:bg-maroon-950 dark:text-maroon-200 dark:ring-gray-800">
                {avatar && !avatarFailed ? (
                  <img
                    src={avatar}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  getInitials(user)
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-950 dark:text-white">
                  {displayName}
                </p>

                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                  {user?.student_id || 'Student Account'}
                </p>

                {(user?.course || user?.profile?.course) && (
                  <p className="mt-0.5 truncate text-[11px] text-gray-400 dark:text-gray-500">
                    {user?.course || user?.profile?.course}
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
                <p className="font-semibold">Profile</p>

                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  View and edit your information
                </p>
              </div>
            </Link>

            <Link
              to="/student/health-profile"
              role="menuitem"
              className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <ClipboardPlus className="h-5 w-5" />
              <span>Health Profile</span>
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
                <p className="font-semibold">Settings</p>

                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Manage account preferences
                </p>
              </div>
            </Link>

            <button
              type="button"
              onClick={toggleDarkMode}
              role="menuitem"
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                <Palette className="h-4 w-4" />
              </div>

              <div className="flex-1">
                <p className="font-semibold">Appearance</p>

                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {darkMode ? 'Dark mode is on' : 'Light mode is on'}
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
              <span className="font-medium">Help &amp; Support</span>
            </Link>

            <Link
              to="/student/about"
              role="menuitem"
              className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Info className="h-4 w-4 text-gray-500" />
              <span className="font-medium">About CareLink</span>
            </Link>

            <div className="my-2 border-t border-gray-100 dark:border-gray-800" />

            <button
              type="button"
              onClick={onLogout}
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
);

export default StudentAccountMenu;
