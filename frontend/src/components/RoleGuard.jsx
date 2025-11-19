import { Navigate, useLocation } from 'react-router-dom';
import { hasMenuAccess, hasPermission } from '../config/rolePermissions';

/**
 * RoleGuard - Protects routes based on user role and permissions
 *
 * Usage:
 * <Route element={<RoleGuard allowedRoles={['admin', 'doctor']}><Component /></RoleGuard>} />
 * <Route element={<RoleGuard requiredPermission="manage_patients"><Component /></RoleGuard>} />
 * <Route element={<RoleGuard menuItem="clinical"><Component /></RoleGuard>} />
 */
export default function RoleGuard({
  children,
  allowedRoles,
  requiredPermission,
  menuItem,
  fallback = '/dashboard',
  showAccessDenied = false
}) {
  const location = useLocation();

  // Get user from localStorage
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
  } catch (err) {
    console.error('Error parsing user:', err);
  }

  const userRole = user?.role;

  // If no user, redirect to login
  if (!user || !userRole) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check allowed roles
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(userRole)) {
      if (showAccessDenied) {
        return <AccessDenied />;
      }
      return <Navigate to={fallback} replace />;
    }
  }

  // Check required permission
  if (requiredPermission) {
    if (!hasPermission(userRole, requiredPermission)) {
      if (showAccessDenied) {
        return <AccessDenied />;
      }
      return <Navigate to={fallback} replace />;
    }
  }

  // Check menu item access
  if (menuItem) {
    if (!hasMenuAccess(userRole, menuItem)) {
      if (showAccessDenied) {
        return <AccessDenied />;
      }
      return <Navigate to={fallback} replace />;
    }
  }

  return children;
}

// Access Denied component
function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto h-24 w-24 text-red-500 mb-4">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Accès refusé</h1>
        <p className="text-gray-600 mb-4">
          Vous n'avez pas les permissions nécessaires pour accéder à cette page.
        </p>
        <button
          onClick={() => window.history.back()}
          className="btn btn-primary"
        >
          Retour
        </button>
      </div>
    </div>
  );
}
