import { Navigate, useLocation } from 'react-router-dom';
const ProtectedRoute = ({ children, role }) => {
  const location = useLocation();
  let user;
  try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch { user = {}; }
  if (!localStorage.getItem('token')) return <Navigate to={role === 'nurse' ? '/carelink-portal' : '/login'} replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={user.role === 'nurse' ? '/nurse/dashboard' : user.role === 'student' ? '/student/dashboard' : '/login'} replace />;
  return children;
};
export default ProtectedRoute;
