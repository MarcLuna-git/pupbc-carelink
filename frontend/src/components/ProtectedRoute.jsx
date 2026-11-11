import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import authService from '../services/authService';
import { clearSession, getUser, hasSession, onSessionChange } from '../services/session';

// Each portal checks only its own session, so a Student and a Nurse login can coexist.
// The session is an httpOnly cookie the page cannot read: after a reload the
// in-memory session is empty, so the guard asks the server once (restoreSession).
const ProtectedRoute = ({ children, role }) => {
  const location = useLocation();
  const loginPath = role === 'nurse' ? '/carelink-portal' : '/login';
  const [state, setState] = useState(() => (hasSession(role) ? 'in' : 'checking'));

  useEffect(() => {
    let active = true;
    if (state === 'checking') {
      authService.restoreSession(role).then((signedIn) => {
        if (active) setState(signedIn ? 'in' : 'out');
      });
    }
    // Sign-out elsewhere in the page (account menu, a rejected request) leaves the portal.
    const stop = onSessionChange((portal) => {
      if (portal === role && !hasSession(role)) setState('out');
    });
    return () => { active = false; stop(); };
  }, [role, state]);

  if (state === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900" role="status" aria-live="polite">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#800000]" aria-hidden="true" />
        <span className="sr-only">Checking your session…</span>
      </div>
    );
  }
  if (state === 'out') return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  if (getUser(role).role !== role) { clearSession(role); return <Navigate to={loginPath} replace />; }
  return children;
};
export default ProtectedRoute;
