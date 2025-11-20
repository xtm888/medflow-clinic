import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission, hasMenuAccess, getAccessibleMenuItems, rolePermissions } from '../config/rolePermissions';

/**
 * usePermissions - Hook for checking user permissions
 *
 * Usage:
 * const { can, canAccess, isAdmin, userRole } = usePermissions();
 *
 * if (can('manage_patients')) {
 *   // Show edit button
 * }
 *
 * if (canAccess('finance')) {
 *   // Show finance menu
 * }
 */
export function usePermissions() {
  const { user } = useAuth();

  const userRole = user?.role || null;

  const permissions = useMemo(() => {
    if (!userRole || !rolePermissions[userRole]) {
      return [];
    }
    return rolePermissions[userRole].permissions || [];
  }, [userRole]);

  const menuItems = useMemo(() => {
    return getAccessibleMenuItems(userRole);
  }, [userRole]);

  /**
   * Check if user has a specific permission
   */
  const can = (permission) => {
    return hasPermission(userRole, permission);
  };

  /**
   * Check if user can access a menu item
   */
  const canAccess = (menuItem) => {
    return hasMenuAccess(userRole, menuItem);
  };

  /**
   * Check if user has any of the given permissions
   */
  const canAny = (permissionList) => {
    return permissionList.some(p => hasPermission(userRole, p));
  };

  /**
   * Check if user has all of the given permissions
   */
  const canAll = (permissionList) => {
    return permissionList.every(p => hasPermission(userRole, p));
  };

  /**
   * Check if user has any of the given roles
   */
  const hasRole = (...roles) => {
    return roles.includes(userRole);
  };

  return {
    user,
    userRole,
    permissions,
    menuItems,
    can,
    canAccess,
    canAny,
    canAll,
    hasRole,
    isAdmin: userRole === 'admin',
    isDoctor: userRole === 'doctor' || userRole === 'ophthalmologist',
    isProvider: ['doctor', 'ophthalmologist', 'orthoptist', 'nurse'].includes(userRole),
    isReceptionist: userRole === 'receptionist',
    isPharmacist: userRole === 'pharmacist',
    isAccountant: userRole === 'accountant'
  };
}

export default usePermissions;
