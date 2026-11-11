/*
 * Per-portal login sessions.
 *
 * The sign-in token is an httpOnly cookie that the server sets (one per
 * portal), so no page script can read it and an injected script (XSS) cannot
 * steal it. API requests name their portal in the X-Portal header (api.js) and
 * the server uses that portal's cookie.
 *
 * This module only remembers who is signed in, in memory. Nothing about the
 * session is kept in localStorage/sessionStorage; after a reload the route
 * guard asks the server again (restoreSession in authService.js). The Student
 * and Nurse portals keep separate sessions, so both can stay open side by side.
 * The kiosk has no user session (it authenticates the device with its own token).
 */

const PORTALS = ['student', 'nurse'];
const users = { student: null, nurse: null };
// Bumps on every sign-in / sign-out, so data fetched for a previous session can be dropped.
const generation = { student: 0, nurse: 0 };
const listeners = new Set();

// The portal a page belongs to, from its URL.
export const portalForPath = (pathname = window.location.pathname) => {
  if (pathname.startsWith('/nurse') || pathname.startsWith('/carelink-portal')) return 'nurse';
  if (pathname.startsWith('/kiosk')) return 'kiosk';
  return 'student';
};

export const currentPortal = () => portalForPath();

const known = (portal) => PORTALS.includes(portal);

const notify = (portal) => listeners.forEach((listener) => {
  try { listener(portal); } catch { /* one listener must not break the others */ }
});

// Called with the portal whenever its signed-in user changes (sign-in, profile save, sign-out).
export const onSessionChange = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const hasSession = (portal = currentPortal()) => known(portal) && !!users[portal];

// Changes whenever someone signs in or out of the portal; null when signed out.
// Not a secret: it only tells callers that the session changed.
export const sessionId = (portal = currentPortal()) =>
  hasSession(portal) ? `${portal}:${users[portal].id ?? ''}:${generation[portal]}` : null;

export const getUser = (portal = currentPortal()) =>
  hasSession(portal) ? { ...users[portal] } : {};

// A new sign-in (login, or the session restored from the cookie after a reload).
export const startSession = (user, portal = currentPortal()) => {
  if (!known(portal) || !user) return;
  users[portal] = { ...user };
  generation[portal] += 1;
  notify(portal);
};

// Updates the signed-in user's details (profile edits); keeps the same session.
export const setUser = (user, portal = currentPortal()) => {
  if (!known(portal)) return;
  if (!user) {
    clearSession(portal);
    return;
  }
  users[portal] = { ...user };
  notify(portal);
};

export const clearSession = (portal = currentPortal()) => {
  if (!known(portal) || !users[portal]) return;
  users[portal] = null;
  generation[portal] += 1;
  notify(portal);
};

/*
 * Older versions kept the token and user in localStorage. Remove them so a
 * token saved before this change does not stay readable on the device.
 */
const LEGACY_KEYS = [
  'token', 'user',
  'carelink.session.student.token', 'carelink.session.student.user',
  'carelink.session.nurse.token', 'carelink.session.nurse.user',
];
try { LEGACY_KEYS.forEach((key) => localStorage.removeItem(key)); } catch { /* storage blocked */ }
