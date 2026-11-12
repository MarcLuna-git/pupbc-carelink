import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';

import NurseSidebar from './nurse-shell/NurseSidebar';
import NurseAccountMenu from './nurse-shell/NurseAccountMenu';
import NurseNotificationsMenu from './nurse-shell/NurseNotificationsMenu';
import './NurseLayout-for-Tablet-View.css';

/*
 * Tablet / desktop outer shell for the Nurse portal (viewport >= 768px).
 *
 * NurseLayout-for-Desktop-View picks between this shell and the mobile shell
 * with a JS media query, so only one shell is ever mounted. This shell owns:
 *   - the collapsible sidebar (icon rail by default on tablet widths,
 *     full sidebar on desktop)
 *   - the header with the breadcrumb, notifications, theme toggle and account button
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
  breadcrumb = [],
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
      />

      <div className="nurse-shell-body" data-route-scroll>
        <header className="nurse-header">
          <div className="nurse-header-inner">
            {/* Breadcrumb, sitting on the header's bottom edge (same as the student portal). */}
            <nav className="nurse-breadcrumb" aria-label="Breadcrumb">
              <ol>
                {breadcrumb.length === 0
                  ? <li aria-current="page">Dashboard</li>
                  : <li><Link to="/nurse/dashboard">Dashboard</Link></li>}
                {breadcrumb.map((label, index) => (
                  <li key={label} aria-current={index === breadcrumb.length - 1 ? 'page' : undefined}>{label}</li>
                ))}
              </ol>
            </nav>
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

              <NurseAccountMenu variant="header" {...accountMenuProps} />
            </div>
          </div>
        </header>

        {children}
      </div>
    </>
  );
};

export default NurseLayoutForTabletView;
