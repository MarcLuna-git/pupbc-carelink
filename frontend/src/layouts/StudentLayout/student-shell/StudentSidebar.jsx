import { Link } from 'react-router-dom';
import { ChevronRight, HeartPulse, X } from 'lucide-react';
import campusBackground from '../../../assets/pup-binan-hero.jpg';
import { preloadForPath } from '../../../utils/preloadStudentPages';
import { STUDENT_NAV_GROUPS } from '../../../utils/studentPortalNavigation';

/*
 * The primary Student navigation.
 *
 * Rendered as the fixed sidebar for the desktop / tablet shells. The mobile
 * shell navigates via its bottom dock navbar and does not render this
 * component, so the drawer-only close button never appears.
 */
const StudentSidebar = ({
  navItems = [],
  isActive = () => false,
  isOpen = false,
  collapsed = false,
  onNavigate,
  onClose,
}) => (
  <aside
    id="student-sidebar"
    aria-label="Student navigation"
    className={`student-sidebar ${isOpen ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''}`}
  >
    <img
      src={campusBackground}
      alt=""
      aria-hidden="true"
      // Loaded right away: lazy loading can skip images inside a fixed, overflow-hidden sidebar.
      loading="eager"
      className="student-sidebar-campus"
    />

    <div className="student-sidebar-brand">
      <Link to="/student/appointments" className="flex items-center gap-3">
        <HeartPulse className="student-brand-symbol" aria-hidden="true" />

        <div className="min-w-0">
          <p className="truncate text-base font-bold leading-tight text-white">
            CareLink
          </p>

          <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
            Student Portal
          </p>
        </div>
      </Link>

      {onClose && (
        <button
          type="button"
          className="student-sidebar-close"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X aria-hidden="true" />
        </button>
      )}
    </div>

    <nav aria-label="Primary student navigation" className="student-sidebar-nav">
      {/* One labelled section per group; links stay direct children of the nav for the shell CSS. */}
      {STUDENT_NAV_GROUPS.map((group) => {
        const items = navItems.filter((item) => item.group === group.key);
        if (!items.length) return null;
        return [
          <h2 key={`${group.key}-heading`} className="student-nav-section">{group.label}</h2>,
          ...items.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                onMouseEnter={() => preloadForPath(item.path)}
                onFocus={() => preloadForPath(item.path)}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                title={item.label}
                className={`group relative flex items-center gap-3 rounded-[10px] px-4 py-3.5 text-sm font-semibold transition-all duration-200 ${
                  active
                    ? 'bg-white text-maroon-900 shadow-lg shadow-black/10'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon
                  aria-hidden="true"
                  className={`h-5 w-5 shrink-0 ${
                    active ? 'text-maroon-800' : 'text-white/75'
                  }`}
                />

                <span className="flex-1">{item.label}</span>

                {active && <ChevronRight className="h-4 w-4 text-maroon-700" />}
              </Link>
            );
          }),
        ];
      })}
    </nav>
  </aside>
);

export default StudentSidebar;
