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

// What each nurse page is for. The title and this line sit in the top header bar, so the pages
// have no title card of their own. The dashboard's title is the greeting instead of a fixed name.
export const NURSE_PAGE_HEADERS = {
  '/nurse/dashboard': { title: null, note: 'PUP Biñan Campus Clinic — here is what is happening in the clinic today.' },
  '/nurse/appointments': { title: 'Appointments', note: 'Review booking requests and approve or decline them. Checked-in students are on the Queue page.' },
  '/nurse/queue': { title: 'Queue', note: 'Today’s clinic queue. Call the next student and confirm when they arrive.' },
  '/nurse/consultation': { title: 'Consultation', note: 'Record the consultation of a patient who arrived, then print their forms.' },
  '/nurse/records': { title: 'Patient History', note: 'Completed consultations and emergency encounters of every student. To see one student’s full record, open Students.' },
  '/nurse/students': { title: 'Students', note: 'Registered students. Open one to see their profile, health record, appointments and clinic history.' },
  '/nurse/faculty': { title: 'Faculty', note: 'Keep a directory of faculty, and record the medicines the clinic dispenses to them.' },
  '/nurse/medicines': { title: 'Medicine Inventory', note: 'Manage clinic medicines and supplies.' },
  '/nurse/academic': { title: 'Course Management', note: 'Organize courses, manage sections, and keep academic periods up to date.' },
  '/nurse/announcements': { title: 'Announcements', note: 'Post clinic and school announcements for students.' },
  '/nurse/settings': { title: 'Settings', note: 'Manage your account, security, and portal preferences.' },
};

// { title, note } for the header bar, or null for a page that is not listed.
export const nurseHeaderFor = (pathname, user, date = new Date()) => {
  const page = NURSE_PAGE_HEADERS[pathname];
  if (!page) return null;
  return { title: page.title || nurseGreeting(user, date), note: page.note };
};
