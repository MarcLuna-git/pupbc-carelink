import { Navigate, useLocation } from 'react-router-dom';
import { clearSession, getToken, getUser } from '../services/session';
// Each portal checks only its own session, so a Student and a Nurse login can coexist.
const ProtectedRoute = ({ children, role }) => {
  const location = useLocation();
  const loginPath = role === 'nurse' ? '/carelink-portal' : '/login';
  if (!getToken(role)) return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  if (getUser(role).role !== role) { clearSession(role); return <Navigate to={loginPath} replace />; }
  return children;
};
export default ProtectedRoute;
