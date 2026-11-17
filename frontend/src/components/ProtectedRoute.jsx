import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function ProtectedRoute({ allowedType, children }) {
  const { user, loading, sessionError } = useAuth();
  if (loading) return <div role="status" className="auth-loading">Loading session…</div>;
  if (!user) return <Navigate to={allowedType === 'staff' ? '/admin/authentication' : '/authentication/login'} replace />;
  if (sessionError) return <div role="alert" className="auth-loading">{sessionError} <button onClick={() => window.location.reload()}>Retry</button></div>;
  if (user.type !== allowedType) return <Navigate to={user.type === 'staff' ? '/admin/' : '/portal'} replace />;
  return children || <Outlet />;
}
