import { Link, useLocation } from 'react-router-dom';
import './ProfileSection.css';

/*
 * Shared shell for the Profile-section pages (Overview, Profile Edit and
 * Health Profile): hero header, horizontal inner tabs and the content card.
 *
 * Pages render this ONLY once their data has loaded — during the loading
 * phase they return <RouteLoading />, so the page behind the curtain is
 * totally blank and the whole section (header + tabs + content) appears in
 * sync the moment loading finishes.
 */
const PROFILE_TABS = [
  { to: '/student/profile', label: 'Overview', isActive: pathname => pathname.startsWith('/student/profile') },
  { to: '/student/health-profile', label: 'Health Profile', isActive: pathname => pathname === '/student/health-profile' },
];

const ProfileSection = ({ children }) => {
  const { pathname } = useLocation();

  return (
    <div className="student-profile-shell">
      <div className="student-profile-hero">
        <h1>Profile</h1>
        <p>View your personal information and manage your Health Profile.</p>
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
