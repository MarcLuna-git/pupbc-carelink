// "Good Morning" / "Good Afternoon" / "Good Evening" by the hour of the day.
export const greetingFor = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
};

// "Good Afternoon, Nurse Jane!"
export const nurseGreeting = (user, date = new Date()) =>
  `${greetingFor(date)}, Nurse ${user?.first_name || 'Head'}!`;

// What each nurse page is for. The title and this line are the page's hero (NursePageTitle);
// the header bar shows the breadcrumb. The dashboard's title is the greeting instead of a fixed name.
export const NURSE_PAGE_HEADERS = {
  '/nurse/dashboard': { title: null, note: 'Here you can see the clinic schedule with upcoming appointments and who needs your medical attention.' },
  '/nurse/appointments': { title: 'Appointments', note: 'Manage the booking requests of students and keep track of their clinic visits.' },
  '/nurse/queue': { title: 'Queue', note: 'Manage the students in queue line today and call each one when it is their turn.' },
  '/nurse/consultation': { title: 'Consultation', note: 'Consult patients and release their medical documents after each visit.' },
  '/nurse/students': { title: 'Students', note: 'Records of each student profile and the health history from their past clinic visits.' },
  '/nurse/faculty': { title: 'Faculty', note: 'Records of the faculty members and the medicines the clinic has given to them.' },
  '/nurse/medicines': { title: 'Medicine Inventory', note: 'Manage the clinic medicines and keep track of the stock that is running low.' },
  '/nurse/academic': { title: 'Course Management', note: 'Manage the courses and sections that students pick when they sign up.' },
  '/nurse/announcements': { title: 'Announcements', note: 'Manage the news for students and post reminders that they see on their portal.' },
  '/nurse/settings': { title: 'Settings', note: 'Manage your account details and choose how the portal works for you.' },
};

// The header breadcrumb after "Dashboard": "Dashboard / Overview" on the dashboard (its sidebar
// name), "Dashboard / <page>" elsewhere.
// An unlisted address under a listed page (e.g. a detail view) uses that page's title.
export const nurseBreadcrumbFor = (pathname) => {
  if (pathname === '/nurse/dashboard') return ['Overview'];
  const path = Object.keys(NURSE_PAGE_HEADERS).find(key => pathname === key || pathname.startsWith(`${key}/`));
  return path && NURSE_PAGE_HEADERS[path].title ? [NURSE_PAGE_HEADERS[path].title] : [];
};

// { title, note } of a page's hero, or null for a page that is not listed.
export const nurseHeaderFor = (pathname, user, date = new Date()) => {
  const page = NURSE_PAGE_HEADERS[pathname];
  if (!page) return null;
  return { title: page.title || nurseGreeting(user, date), note: page.note };
};
