export const STUDENT_PRIMARY_LINKS = [
  { key: 'appointments', path: '/student/appointments', label: 'Appointments' },
  { key: 'qr', path: '/student/qr', label: 'QR Code' },
  { key: 'records', path: '/student/health-records', label: 'Records' },
  { key: 'profile', path: '/student/profile', label: 'Profile' },
  { key: 'settings', path: '/student/settings', label: 'Settings' },
];

/* Ask the portal frame to open its Sign out confirmation (used by pages that
   sit outside the frame's props, e.g. Settings on mobile). */
export const STUDENT_LOGOUT_REQUEST_EVENT = 'carelink:student-logout-request';

const matches =(pathname, path) => pathname === path || pathname.startsWith(`${path}/`);

export function isStudentNavActive(pathname, path) {
  if (path === '/student/profile') {
    /* Settings is now its own primary tab, so it is no longer part of the
       Profile group. Health Profile and the account pages still are. */
    return ['profile', 'health-profile', 'help', 'about']
      .some(section => matches(pathname, `/student/${section}`));
  }
  return matches(pathname, path);
}

export function studentPageTitle(pathname) {
  const accountTitles = {
    '/student/health-profile': 'Health Profile', '/student/settings': 'Settings',
    '/student/alerts': 'Notifications', '/student/help': 'Help & Support',
    '/student/about': 'About CareLink', '/student/announcements': 'Announcements',
  };
  return accountTitles[pathname] || STUDENT_PRIMARY_LINKS.find(item => matches(pathname, item.path))?.label || 'Student Portal';
}
