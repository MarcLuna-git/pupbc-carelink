import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronsLeft, ChevronsRight, Moon, Sun } from 'lucide-react';

import NurseSidebar from './nurse-shell/NurseSidebar';
import './NurseLayout-for-Tablet-View.css';

/*
 * Tablet / desktop outer shell for the Nurse portal (viewport >= 768px).
 *
 * NurseLayout-for-Desktop-View picks between this shell and the mobile shell
 * with a JS media query, so only one shell is ever mounted. This shell owns:
 *   - the collapsible sidebar (icon rail by default on tablet widths,
 *     full sidebar on desktop) with the account button at its foot
 *   - the header with the page title, notifications and theme toggle
 * The routed page arrives through `children`.
 */
const TABLET_QUERY = '(max-width: 1099px)';

const NurseLayoutForTabletView = ({
  children,
  navItems,
  isActive,
  unreadCount,
  darkMode,
  toggleDarkMode,
  accountMenuProps,
}) => {
  // Center the pull tab on the brand symbol's rendered position.
  const [toggleTop, setToggleTop] = useState(40);

  useEffect(() => {
    const measure = () => {
      const symbol = document.querySelector('.nurse-brand-symbol');
      if (!symbol) return;
      const rect = symbol.getBoundingClientRect();
      if (rect.height > 0) setToggleTop(rect.top + rect.height / 2);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Folded rail on tablet widths, full sidebar on desktop; crossing the
  // breakpoint re-applies its default, the toggle changes it otherwise.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(TABLET_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const tabletQuery = window.matchMedia(TABLET_QUERY);
    const handleBreakpointChange = (event) => setSidebarCollapsed(event.matches);
    tabletQuery.addEventListener('change', handleBreakpointChange);
    return () => tabletQuery.removeEventListener('change', handleBreakpointChange);
  }, []);

  return (
    <>
      <NurseSidebar
        navItems={navItems}
        isActive={isActive}
        collapsed={sidebarCollapsed}
        unreadCount={unreadCount}
        accountMenuProps={accountMenuProps}
      />

      {/* Pull tab merged with the sidebar's right edge (rendered outside the
          <aside>, which clips overflow). */}
      <button
        type="button"
        className="nurse-sidebar-toggle"
        style={{ top: `${toggleTop}px` }}
        aria-controls="nurse-sidebar"
        aria-expanded={!sidebarCollapsed}
        aria-label={sidebarCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={() => setSidebarCollapsed((value) => !value)}
      >
        {sidebarCollapsed ? <ChevronsRight aria-hidden="true" /> : <ChevronsLeft aria-hidden="true" />}
      </button>

      <div className="nurse-shell-body" data-route-scroll>
        <header className="nurse-header">
          <div className="nurse-header-inner">
            <div className="nurse-header-actions">
              <Link
                to="/nurse/notifications"
                aria-label={unreadCount > 0 ? `Open notifications (${unreadCount} unread)` : 'Open notifications'}
                title="Notifications"
                className="nurse-header-icon nurse-notification-bell"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="nurse-bell-count" aria-hidden="true">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>

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
            </div>
          </div>
        </header>

        {children}
      </div>
    </>
  );
};

export default NurseLayoutForTabletView;
