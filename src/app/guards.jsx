// Route guards. They mirror the API panel guards; the API stays the real
// authority, these only keep users on screens they can use.
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PageSpinner } from '@/shared/ui';
import { HOME, useAuth } from '@/modules/auth';
import NoAccess from '@/shared/components/NoAccess';

export function RequireAuth({ children }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <PageSpinner />;
  if (status !== 'authed') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (user.mustChangePassword && location.pathname !== '/account/change-password') return <Navigate to="/account/change-password" replace />;
  return children || <Outlet />;
}

export function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user.role)) return <Navigate to={HOME[user.role] || '/'} replace />;
  return children || <Outlet />;
}

export function RequirePermission({ permission, children }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return <NoAccess permission={permission} />;
  return children || <Outlet />;
}

export function RequireBuilder({ children }) {
  const { user } = useAuth();
  if (user.listerType !== 'builder') return <Navigate to="/lister" replace />;
  return children || <Outlet />;
}

// Login and signup pages: a signed-in user goes to their panel instead.
export function GuestOnly({ children }) {
  const { status, home } = useAuth();
  if (status === 'loading') return <PageSpinner />;
  if (status === 'authed') return <Navigate to={home} replace />;
  return children || <Outlet />;
}
