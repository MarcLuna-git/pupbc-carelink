import { Link } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import NurseAccountMenu from './NurseAccountMenu';
import clinicBackground from '../../../assets/clinic-waiting-area.jpg';

/*
 * The Nurse portal navigation, rendered as the fixed sidebar of the
 * tablet / desktop shell. Mobile navigates through its bottom dock instead.
 */
const NurseSidebar = ({
  navItems = [],
  isActive = () => false,
  collapsed = false,
  unreadCount = 0,
  accountMenuProps,
}) => (
  <aside
    id="nurse-sidebar"
    aria-label="Nurse navigation"
    className={`nurse-sidebar${collapsed ? ' is-collapsed' : ''}`}
  >
    <img
      src={clinicBackground}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className="nurse-sidebar-campus"
    />

    <div className="nurse-sidebar-brand">
      <Link to="/nurse/dashboard" className="flex items-center gap-3">
        <span className="nurse-brand-symbol" aria-hidden="true">
          <Stethoscope />
        </span>

        <div className="min-w-0">
          <p className="truncate text-base font-bold leading-tight text-white">CareLink</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-300/80">
            Nurse Portal
          </p>
        </div>
      </Link>
    </div>

    <nav aria-label="Primary nurse navigation" className="nurse-sidebar-nav">
      {navItems.map((item) => {
        const active = isActive(item.path);
        const Icon = item.icon;
        const showCount = item.path === '/nurse/notifications' && unreadCount > 0;

        return (
          <Link
            key={item.path}
            to={item.path}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            title={item.label}
            className="nurse-nav-link"
          >
            <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span className="nurse-nav-label">{item.label}</span>
            {showCount && (
              <span className="nurse-nav-count" aria-hidden="true">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>

    <div className="nurse-sidebar-footer">
      <NurseAccountMenu variant="sidebar" collapsed={collapsed} unreadCount={unreadCount} {...accountMenuProps} />
    </div>
  </aside>
);

export default NurseSidebar;
