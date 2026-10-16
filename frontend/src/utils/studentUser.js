/*
 * Shared helpers for reading the logged-in Student from storage.
 *
 * Used by the Student shell (StudentLayout-for-Web-View) and by the account menu.
 */

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

export const getAvatar = (user) =>
  user?.profile?.profile_picture ||
  user?.profile_picture ||
  user?.avatar_url ||
  '';

export const getDisplayName = (user) => {
  const name = [user?.first_name, user?.middle_name, user?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();

  return name || 'Student';
};

export const getInitials = (user) => {
  const first = String(user?.first_name || '').trim();
  const last = String(user?.last_name || '').trim();
  const initials = `${first.charAt(0)}${last.charAt(0)}`.trim();

  return initials.toUpperCase() || 'S';
};
