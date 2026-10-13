export const STUDENT_PRIMARY_LINKS = [
  { key: 'appointments', path: '/student/appointments', label: 'Appointments' },
  { key: 'qr', path: '/student/qr', label: 'QR Code' },
  { key: 'records', path: '/student/health-records', label: 'Records' },
  { key: 'profile', path: '/student/profile', label: 'Profile' },
];

const matches = (pathname, path) => pathname === path || pathname.startsWith(`${path}/`);

export function isStudentNavActive(pathname, path) {
  if (path === '/student/profile') {
    return ['profile', 'health-profile', 'settings', 'help', 'about']
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
