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

// Pages whose title and purpose sit in the top header bar instead of a title card.
// A page is added here as its own title card is removed.
export const NURSE_HEADER_NOTES = {
  '/nurse/dashboard': 'PUP Biñan Campus Clinic — here is what is happening in the clinic today.',
  '/nurse/appointments': 'Review booking requests and approve or decline them. Check-ins and consultations are on the Consultation page.',
};

export const NURSE_HEADER_TITLES = {
  '/nurse/appointments': 'Appointments',
};

// { title, note } for the header bar, or null when the page keeps its own title card.
export const nurseHeaderFor = (pathname, user, date = new Date()) => {
  const note = NURSE_HEADER_NOTES[pathname];
  if (!note) return null;
  return { title: pathname === '/nurse/dashboard' ? nurseGreeting(user, date) : NURSE_HEADER_TITLES[pathname], note };
};
