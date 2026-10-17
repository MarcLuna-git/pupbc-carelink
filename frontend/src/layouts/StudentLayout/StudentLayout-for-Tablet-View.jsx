import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronsLeft, ChevronsRight, Moon, Sun } from 'lucide-react';

import StudentSidebar from './student-shell/StudentSidebar';
import StudentAccountMenu from './student-shell/StudentAccountMenu';
import './StudentLayout-for-Tablet-View.css';

/*
 * Tablet / desktop outer shell for the Student portal (viewport >= 768px).
 *
 * StudentLayout-for-Desktop-View picks between this shell and the mobile shell with a JS media
 * query, so only one shell is ever mounted. This component owns the
 * tablet-only chrome:
 *   - fixed sidebar (rendered via the shared StudentSidebar)
 *   - header with search, clinic status, alerts / theme / account (no page
 *     title — pages show their own headings)
 * The page content is injected through `children`; shared data and handlers
 * are passed down from StudentLayout-for-Desktop-View so logic is never duplicated.
 *
 * The tablet icon-rail (768-1099px) is handled purely in CSS.
 */
const StudentLayoutForTabletView = ({
  children,
  user,
  displayName,
  avatar,
  avatarFailed,
  setAvatarFailed,
  navItems,
  isActive,
  unreadCount,
  darkMode,
  toggleDarkMode,
  query,
  setQuery,
  profileMenuOpen,
  setProfileMenuOpen,
  profileMenuRef,
  onLogout,
}) => {
  const navigate = useNavigate();

  /* Sidebar search: submitting jumps to Appointments, which filters by `query`. */
  const handleSearchSubmit = (event) => {
    event.preventDefault();
    navigate('/student/appointments');
  };
  /*
   * Toggle button vertical position: measured from the brand symbol's
   * ACTUAL rendered center (getBoundingClientRect), so the pull tab is
   * dead-center aligned with the logo icon regardless of font metrics —
   * no estimated pixel values.
   */
  const [toggleTop, setToggleTop] = useState(40);

  useEffect(() => {
    const measure = () => {
      const symbol = document.querySelector('.student-brand-symbol');
      if (!symbol) return;
      const rect = symbol.getBoundingClientRect();
      if (rect.height > 0) setToggleTop(rect.top + rect.height / 2);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  /*
   * Collapsible sidebar state.
   *
   * DEFAULT depends on the active breakpoint (the "responsive trigger"):
   *   - Tablet widths (768-1099px) -> MINIMIZE: folded 76px icon rail
   *   - Desktop widths (>= 1100px) -> MAXIMIZE: full 198px sidebar with
   *     its contents visible
   * Crossing the 1099px breakpoint re-applies that breakpoint's default.
   * Within one breakpoint, the toggle button is the only thing that
   * changes the state.
   */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(max-width: 1099px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const tabletQuery = window.matchMedia('(max-width: 1099px)');
    const handleBreakpointChange = (event) => setSidebarCollapsed(event.matches);
    tabletQuery.addEventListener('change', handleBreakpointChange);
    return () => tabletQuery.removeEventListener('change', handleBreakpointChange);
  }, []);

  return (
    <>
      <StudentSidebar
        navItems={navItems}
        isActive={isActive}
        collapsed={sidebarCollapsed}
        searchValue={query}
        onSearchChange={(event) => setQuery(event.target.value)}
        onSearchSubmit={handleSearchSubmit}
        onSearchExpand={() => setSidebarCollapsed(false)}
      />

      {/*
        * Floating collapse toggle. Rendered outside the <aside> (which has
        * overflow:hidden) but styled to merge with the sidebar — flush
        * against its right edge, sharing its maroon background — so the
        * sidebar and the button read as one shape with a pull tab.
        */}
      <button
        type="button"
        className="student-sidebar-toggle"
        style={{ top: `${toggleTop}px` }}
        aria-controls="student-sidebar"
        aria-expanded={!sidebarCollapsed}
        aria-label={sidebarCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={() => setSidebarCollapsed((value) => !value)}
      >
        {sidebarCollapsed ? <ChevronsRight aria-hidden="true" /> : <ChevronsLeft aria-hidden="true" />}
      </button>

      <div className="student-shell-body">
      {/* Header */}
      <header className="student-header">
        <div className="student-header-inner">
          {/* Invisible spacer: holds the header layout balance now that the
              page-title text and search field are removed. */}
          <div className="student-header-page" aria-hidden="true" />

          {/* Header actions */}
          <div className="student-header-actions">
            {/* Combined Notifications + Announcements */}
            <Link
              to="/student/alerts"
              aria-label="Open notifications and announcements"
              title="Notifications & Announcements"
              className="student-header-icon student-notification-bell"
            >
              <Bell className="h-5 w-5" />

              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-900">
                  {unreadCount > 99
                    ? '99+'
                    : unreadCount}
                </span>
              )}
            </Link>

            {/* Quick appearance toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label={
                darkMode
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
              }
              title={
                darkMode
                  ? 'Light mode'
                  : 'Dark mode'
              }
              className="student-header-icon student-theme-toggle"
            >
              {darkMode ? (
                <Sun className="h-5 w-5 text-yellow-400" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>

            {/* Account menu */}
            <StudentAccountMenu
              user={user}
              displayName={displayName}
              avatar={avatar}
              avatarFailed={avatarFailed}
              setAvatarFailed={setAvatarFailed}
              profileMenuOpen={profileMenuOpen}
              setProfileMenuOpen={setProfileMenuOpen}
              profileMenuRef={profileMenuRef}
              darkMode={darkMode}
              toggleDarkMode={toggleDarkMode}
              onLogout={onLogout}
            />
          </div>
        </div>
      </header>

      {children}
    </div>
    </>
  );
};

export default StudentLayoutForTabletView;
