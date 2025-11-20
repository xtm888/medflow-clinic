import { useAuth } from '../contexts/AuthContext';
import { hasPermission, hasMenuAccess } from '../config/rolePermissions';

/**
 * PermissionGate - Conditionally renders children based on permissions
 *
 * Usage:
 * <PermissionGate permission="manage_patients">
 *   <EditButton />
 * </PermissionGate>
 *
 * <PermissionGate roles={['admin', 'doctor']}>
 *   <SensitiveData />
 * </PermissionGate>
 *
 * <PermissionGate menuItem="finance" fallback={<UpgradePrompt />}>
 *   <FinancialReport />
 * </PermissionGate>
 */
export default function PermissionGate({
  children,
  permission,
  roles,
  menuItem,
  fallback = null
}) {
  const { user } = useAuth();
  const userRole = user?.role;

  // If no user, don't render
  if (!user || !userRole) {
    return fallback;
  }

  // Check specific permission
  if (permission) {
    if (!hasPermission(userRole, permission)) {
      return fallback;
    }
  }

  // Check allowed roles
  if (roles && roles.length > 0) {
    if (!roles.includes(userRole)) {
      return fallback;
    }
  }

  // Check menu item access
  if (menuItem) {
    if (!hasMenuAccess(userRole, menuItem)) {
      return fallback;
    }
  }

  return children;
}

/**
 * withPermission - HOC for permission-based rendering
 *
 * Usage:
 * export default withPermission(MyComponent, { permission: 'manage_patients' });
 */
export function withPermission(Component, options) {
  return function PermissionWrappedComponent(props) {
    return (
      <PermissionGate {...options}>
        <Component {...props} />
      </PermissionGate>
    );
  };
}
