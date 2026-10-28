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
