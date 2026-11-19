import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid, Moon, Stethoscope, Sun, X } from 'lucide-react';

import NurseAccountMenu from './nurse-shell/NurseAccountMenu';
import NurseNotificationsMenu from './nurse-shell/NurseNotificationsMenu';
import './NurseLayout-for-Mobile-View.css';

/*
 * Mobile outer shell for the Nurse portal (viewport <= 767px).
 *
 * Header with brand, notifications, theme and the account menu (avatar);
 * a bottom dock with the main clinic pages; and a "More" sheet listing the
 * rest of the nurse pages (the portal has too many for one dock).
 */
const NurseLayoutForMobileView = ({
  children,
  navItems,
  isActive,
  unreadCount,
  onUnreadCount,
  darkMode,
  toggleDarkMode,
  accountMenuProps,
}) => {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const dockItems = navItems.filter((item) => item.dock);
  const moreItems = navItems.filter((item) => !item.dock);
  const moreActive = moreItems.some((item) => isActive(item.path));
  // Live counts of the pages behind "More" (Consultation) show on the More button too.
  const moreCount = moreItems.reduce((total, item) => total + (item.count || 0), 0);

  useEffect(() => setMoreOpen(false), [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onKeyDown = (event) => event.key === 'Escape' && setMoreOpen(false);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [moreOpen]);

  const dockLinkClass = (active) =>
    `relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-[10px] px-1 transition-colors ${
      active
        ? 'text-maroon-800 dark:text-white'
        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
    }`;

  const activePill = (
    <motion.div
      layoutId="nurse-mobile-active-tab"
      className="absolute inset-1 rounded-[10px] bg-maroon-50 dark:bg-white/10"
      transition={{ type: 'spring', stiffness: 500, damping: 34 }}
    />
  );

  return (
    <>
      <div className="nurse-shell-body" data-route-scroll>
        <header className="nurse-header">
          <div className="nurse-header-inner">
            <Link to="/nurse/dashboard" className="nurse-header-brand">
              <span className="nurse-header-brand-symbol" aria-hidden="true">
                <Stethoscope />
              </span>
              <span className="min-w-0">
                <span className="nurse-header-brand-name">CareLink</span>
                <span className="nurse-header-brand-caption">Nurse Portal</span>
              </span>
            </Link>

            <div className="nurse-header-actions">
              <NurseNotificationsMenu unreadCount={unreadCount} onUnreadCount={onUnreadCount} />

              <button
                type="button"
                onClick={toggleDarkMode}
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-pressed={darkMode}
                title={darkMode ? 'Light mode' : 'Dark mode'}
                className="nurse-header-icon nurse-theme-toggle"
              >
                {darkMode ? <Sun className="h-5 w-5 text-yellow-500" /> : <Moon className="h-5 w-5" />}
              </button>

              <NurseAccountMenu variant="header" unreadCount={unreadCount} {...accountMenuProps} />
            </div>
          </div>
        </header>

        {children}
      </div>

      <nav aria-label="Mobile nurse navigation" className="nurse-bottom-nav">
        <div className="grid grid-cols-5">
          {dockItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.count > 0 ? `${item.label}, ${item.count} ${item.countLabel}` : item.label}
                aria-current={active ? 'page' : undefined}
                className={dockLinkClass(active)}
              >
                {active && activePill}
                <Icon className="relative z-10 h-5 w-5" />
                <span className="relative z-10 max-w-full truncate text-xs font-semibold leading-none">{item.label}</span>
                {item.count > 0 && <span className="nurse-nav-count" aria-hidden="true">{item.count > 99 ? '99+' : item.count}</span>}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={dockLinkClass(moreActive)}
          >
            {moreActive && activePill}
            <LayoutGrid className="relative z-10 h-5 w-5" />
            <span className="relative z-10 text-xs font-semibold leading-none">More</span>
            {moreCount > 0 && <span className="nurse-nav-count" aria-hidden="true">{moreCount > 99 ? '99+' : moreCount}</span>}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              key="nurse-more-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
              onClick={() => setMoreOpen(false)}
            />
            <motion.section
              key="nurse-more-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="nurse-more-title"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 40 }}
              className="nurse-more-sheet"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 id="nurse-more-title" className="text-sm font-bold text-gray-900 dark:text-white">More pages</h2>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  aria-label="Close"
                  className="rounded-[10px] p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {moreItems.map((item) => {
                  const active = isActive(item.path);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex flex-col items-center gap-2 rounded-[10px] p-3 text-center transition-colors ${
                        active
                          ? 'bg-maroon-50 text-maroon-800 dark:bg-white/10 dark:text-white'
                          : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-br from-maroon-800 to-maroon-900 text-white shadow-lg shadow-maroon-900/20 dark:from-gray-700 dark:to-gray-800">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-xs font-medium">{item.label}</span>
                      {item.count > 0 && <span className="nurse-nav-count" aria-hidden="true">{item.count > 99 ? '99+' : item.count}</span>}
                    </Link>
                  );
                })}
              </div>
            </motion.section>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default NurseLayoutForMobileView;
