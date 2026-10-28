import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

import NurseSidebar from './nurse-shell/NurseSidebar';
import NurseNotificationsMenu from './nurse-shell/NurseNotificationsMenu';
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
  onUnreadCount,
  darkMode,
  toggleDarkMode,
  accountMenuProps,
  header = null,
}) => {
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
        onToggle={() => setSidebarCollapsed((value) => !value)}
        accountMenuProps={accountMenuProps}
      />

      <div className="nurse-shell-body" data-route-scroll>
        <header className="nurse-header">
          <div className="nurse-header-inner">
            {header && (
              <div className="nurse-header-greeting">
                <p className="nurse-header-greeting-title">{header.title}</p>
                <p className="nurse-header-greeting-note">{header.note}</p>
              </div>
            )}
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
            </div>
          </div>
        </header>

        {children}
      </div>
    </>
  );
};

export default NurseLayoutForTabletView;
