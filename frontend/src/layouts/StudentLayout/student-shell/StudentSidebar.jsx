import { Link } from 'react-router-dom';
import { ChevronRight, HeartPulse, X } from 'lucide-react';
import campusBackground from '../../../assets/pup-binan-hero.jpg';

/*
 * The primary Student navigation.
 *
 * This single component is reused by both shells so the nav markup lives
 * in one place:
 *   - Desktop / laptop: rendered as the fixed sidebar (no close button).
 *   - Mobile: rendered inside StudentLayout-for-Mobile-View as a drawer.
 *
 * `onClose` is only provided by the mobile drawer, which is why the close
 * button appears there and not in the desktop sidebar.
 */
const StudentSidebar = ({
  navItems = [],
  isActive = () => false,
  isOpen = false,
  onNavigate,
  onClose,
}) => (
  <aside
    id="student-sidebar"
    aria-label="Student navigation"
    className={`student-sidebar ${isOpen ? 'is-open' : ''}`}
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

    <div className="student-sidebar-tagline">
      Your Health. Our Care.
      <br />A Healthier PUPBC Community.
    </div>
  </aside>
);

export default StudentSidebar;
