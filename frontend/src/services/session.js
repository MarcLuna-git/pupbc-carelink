/*
 * Per-portal login sessions.
 *
 * The Student portal and the Nurse portal keep their own token + user under
 * separate storage keys, so signing in to one never replaces the other — both
 * can stay open side by side in the same browser. The kiosk has no user
 * session (it authenticates the device with its own sessionStorage token).
 */

const KEYS = {
  student: { token: 'carelink.session.student.token', user: 'carelink.session.student.user' },
  nurse: { token: 'carelink.session.nurse.token', user: 'carelink.session.nurse.user' },
};

// The portal a page belongs to, from its URL.
export const portalForPath = (pathname = window.location.pathname) => {
  if (pathname.startsWith('/nurse') || pathname.startsWith('/carelink-portal')) return 'nurse';
  if (pathname.startsWith('/kiosk')) return 'kiosk';
  return 'student';
};

export const currentPortal = () => portalForPath();

export const sessionKeys = (portal = currentPortal()) => KEYS[portal] || null;

const read = key => {
  try { return localStorage.getItem(key); } catch { return null; }
};

const write = (key, value) => {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* Storage blocked: the in-memory page state still works. */ }
};

export const getToken = (portal = currentPortal()) => {
  const keys = sessionKeys(portal);
  return keys ? read(keys.token) : null;
};

export const setToken = (token, portal = currentPortal()) => {
  const keys = sessionKeys(portal);
  if (keys) write(keys.token, token);
};

export const getUser = (portal = currentPortal()) => {
  const keys = sessionKeys(portal);
  if (!keys) return {};
  try { return JSON.parse(read(keys.user) || '{}') || {}; } catch { return {}; }
};

export const setUser = (user, portal = currentPortal()) => {
  const keys = sessionKeys(portal);
  if (keys) write(keys.user, user ? JSON.stringify(user) : null);
};

export const clearSession = (portal = currentPortal()) => {
  const keys = sessionKeys(portal);
  if (!keys) return;
  write(keys.token, null);
  write(keys.user, null);
};

/*
 * One-time move of the old shared `token` / `user` keys into the portal that
 * owns them, so people already signed in are not logged out by this change.
 */
const migrateLegacySession = () => {
  const token = read('token');
  if (token) {
    let user = {};
    try { user = JSON.parse(read('user') || '{}') || {}; } catch { user = {}; }
    const portal = user.role === 'nurse' ? 'nurse' : 'student';
    if (!getToken(portal)) {
      setToken(token, portal);
      setUser(user, portal);
    }
  }
  write('token', null);
  write('user', null);
};

migrateLegacySession();
