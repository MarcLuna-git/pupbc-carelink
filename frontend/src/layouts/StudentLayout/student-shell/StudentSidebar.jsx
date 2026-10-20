import { Link } from 'react-router-dom';
import { ChevronRight, HeartPulse, X } from 'lucide-react';
import StudentAccountMenu from './StudentAccountMenu';
import campusBackground from '../../../assets/pup-binan-hero.jpg';
import { preloadForPath } from '../../../utils/preloadStudentPages';

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
      loading="lazy"
      className="student-sidebar-campus"
    />

    <div className="student-sidebar-brand">
      <Link to="/student/appointments" className="flex items-center gap-3">
        <HeartPulse className="student-brand-symbol" aria-hidden="true" />

        <div className="min-w-0">
          <p className="truncate text-base font-bold leading-tight text-white">
            CareLink
          </p>

          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">
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
      <p className="px-4 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
        Main Menu
      </p>

      {navItems.map((item) => {
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
            className={`group relative flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all duration-200 ${
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
      })}
    </nav>

    {/* User account (relocated from the header) pinned to the sidebar's
        foot: avatar + name + course; opens the account dropdown upward. On
        the folded tablet rail only the avatar shows. */}
    <div className="student-sidebar-footer">
      <StudentAccountMenu variant="sidebar" collapsed={collapsed} />
    </div>
  </aside>
);

export default StudentSidebar;
