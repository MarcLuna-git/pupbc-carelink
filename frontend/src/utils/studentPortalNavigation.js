/* `group` sorts the sidebar into labelled sections. Management holds the
   clinic visit flow in order: book an appointment, then check in with the QR
   code to join the queue. */
export const STUDENT_NAV_GROUPS = [
  { key: 'management', label: 'Management' },
  { key: 'record', label: 'Medical' },
  { key: 'account', label: 'Account' },
];

export const STUDENT_PRIMARY_LINKS = [
  { key: 'appointments', path: '/student/appointments', label: 'Appointments', group: 'management' },
  { key: 'qr', path: '/student/qr', label: 'QR Code', group: 'management' },
  { key: 'records', path: '/student/health-records', label: 'Health Records', shortLabel: 'Records', group: 'record' },
  { key: 'profile', path: '/student/profile', label: 'Profile', group: 'account' },
  { key: 'settings', path: '/student/settings', label: 'Settings', group: 'account' },
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
