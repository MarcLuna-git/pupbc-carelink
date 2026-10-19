import { Link, useLocation } from 'react-router-dom';
import RouteLoadingBar from '../../../components/RouteLoadingBar';
import './ProfileSection.css';

/*
 * Shared shell for the Profile-section pages (Overview, Profile Edit and
 * Health Profile): hero header, horizontal inner tabs and the content card.
 *
 * Pages render this immediately: while a page loads it passes `loading`, so
 * the hero shows the looping route-loading progress bar (same effect and
 * placement as the Settings hero) while the card holds the page's skeleton
 * ghosts. The bar lives ONLY on the hero — never on the page's forms.
 */
const PROFILE_TABS = [
  { to: '/student/profile', label: 'Overview', isActive: pathname => pathname.startsWith('/student/profile') },
  { to: '/student/health-profile', label: 'Health Profile', isActive: pathname => pathname === '/student/health-profile' },
];

const ProfileSection = ({ children, loading = false }) => {
  const { pathname } = useLocation();

  return (
    <div className="student-profile-shell">
      <div className="student-profile-hero relative overflow-hidden">
        <h1>Profile</h1>
        <p>View your personal information and manage your Health Profile.</p>

        {/* Route-loading bar — full-width fill/drain loop, hero only. */}
        {loading && <RouteLoadingBar />}
      </div>

      <nav aria-label="Profile sections" className="student-profile-tabs">
        {PROFILE_TABS.map(tab => (
          <Link key={tab.to} to={tab.to} aria-current={tab.isActive(pathname) ? 'page' : undefined}>{tab.label}</Link>
        ))}
      </nav>

      <div className="student-profile-card">
        <div className="student-profile-panel">{children}</div>
      </div>
    </div>
  );
};

export default ProfileSection;
