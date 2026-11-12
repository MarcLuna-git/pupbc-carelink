import { Link } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, Stethoscope } from 'lucide-react';
import { NURSE_NAV_GROUPS } from './nurseNavigation';
import clinicBackground from '../../../assets/clinic-waiting-area.jpg';

/*
 * The Nurse portal navigation, rendered as the fixed sidebar of the
 * tablet / desktop shell. Mobile navigates through its bottom dock instead.
 */
const NurseSidebar = ({
  navItems = [],
  isActive = () => false,
  collapsed = false,
  onToggle,
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
      // Loaded right away: lazy loading can skip images inside a fixed, overflow-hidden sidebar.
      loading="eager"
      className="nurse-sidebar-campus"
    />

    <div className="nurse-sidebar-brand">
      <Link to="/nurse/dashboard" className="flex items-center gap-3">
        <span className="nurse-brand-symbol" aria-hidden="true">
          <Stethoscope />
        </span>

        <div className="min-w-0">
          <p className="truncate text-base font-bold leading-tight text-white">CareLink</p>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-yellow-300">
            Nurse Portal
          </p>
        </div>
      </Link>

      {/* Collapse / expand toggle inside the brand row. On the folded rail it
          sits over the logo and shows on hover or focus (a tap on touch). */}
      {onToggle && (
        <button
          type="button"
          className="nurse-sidebar-collapse"
          aria-controls="nurse-sidebar"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggle}
        >
          {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
        </button>
      )}
    </div>

    <nav aria-label="Primary nurse navigation" className="nurse-sidebar-nav">
      {/* Ungrouped links (Dashboard) first, then one labelled section per group.
          Links stay direct children of the nav for the shell CSS. */}
      {[{ key: null }, ...NURSE_NAV_GROUPS].map((group) => {
        const items = navItems.filter((item) => (item.group || null) === group.key);
        if (!items.length) return null;
        return [
          group.label && <h2 key={`${group.key}-heading`} className="nurse-nav-section">{group.label}</h2>,
          ...items.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.count > 0 ? `${item.label}, ${item.count} ${item.countLabel}` : item.label}
                aria-current={active ? 'page' : undefined}
                title={item.label}
                className="nurse-nav-link"
              >
                <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                <span className="nurse-nav-label">{item.label}</span>
                {item.count > 0 && <span className="nurse-nav-count" aria-hidden="true">{item.count > 99 ? '99+' : item.count}</span>}
              </Link>
            );
          }),
        ];
      })}
    </nav>
  </aside>
);

export default NurseSidebar;
