import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import authService from '../services/authService';

const AuthContext = createContext({});

// Store reference for Redux sync - will be set lazily
let storeRef = null;
let authActionsRef = null;

const getStoreAndActions = async () => {
  if (storeRef && authActionsRef) return { store: storeRef, actions: authActionsRef };

  try {
    const [storeModule, authSliceModule] = await Promise.all([
      import('../store'),
      import('../store/slices/authSlice')
    ]);
    storeRef = storeModule.store;
    authActionsRef = {
      setCredentials: authSliceModule.setCredentials,
      clearCredentials: authSliceModule.clearCredentials,
      setPermissions: authSliceModule.setPermissions
    };
    return { store: storeRef, actions: authActionsRef };
  } catch (e) {
    console.warn('[AuthContext] Could not load store for Redux sync:', e);
    return { store: null, actions: null };
  }
};

// Sync auth state to Redux
const syncToRedux = async (user, token = null) => {
  try {
    const { store, actions } = await getStoreAndActions();
    if (!store || !actions) return;

    if (user) {
      const authToken = token || localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refreshToken');
      store.dispatch(actions.setCredentials({
        user,
        token: authToken,
        refreshToken
      }));
      if (user.permissions) {
        store.dispatch(actions.setPermissions(user.permissions));
      }
    } else {
      store.dispatch(actions.clearCredentials());
    }
  } catch (e) {
    console.warn('[AuthContext] Redux sync error:', e);
  }
};

// Default values when not in provider (for error boundary recovery)
const defaultAuthContext = {
  user: null,
  loading: false,
  error: null,
  isAuthenticated: false,
  login: () => Promise.resolve({ success: false }),
  logout: () => Promise.resolve(),
  updateUser: () => {},
  checkAuth: () => Promise.resolve()
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    console.warn('useAuth called outside AuthProvider - using default values');
    return defaultAuthContext;
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is logged in on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setLoading(true);
      if (authService.isAuthenticated()) {
        const result = await authService.getCurrentUser();
        if (result.success) {
          // Fetch role permissions from database (same as login)
          try {
            const permissionsResponse = await authService.getRolePermissions();
            if (permissionsResponse.success) {
              result.user.permissions = permissionsResponse.data.permissions;
              result.user.menuItems = permissionsResponse.data.menuItems;
            }
          } catch (permError) {
            console.warn('Failed to fetch role permissions on refresh, using defaults:', permError);
          }

          setUser(result.user);
          // Sync to Redux
          syncToRedux(result.user);
        } else {
          // Token might be expired
          setUser(null);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          // Sync to Redux
          syncToRedux(null);
        }
      } else {
        setUser(null);
        // Sync to Redux
        syncToRedux(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
      syncToRedux(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      setLoading(true);
      setError(null);
      const result = await authService.login(credentials);
      if (result.success) {
        // Fetch role permissions from database
        try {
          const permissionsResponse = await authService.getRolePermissions();
          if (permissionsResponse.success) {
            result.user.permissions = permissionsResponse.data.permissions;
            result.user.menuItems = permissionsResponse.data.menuItems;
          }
        } catch (permError) {
          console.warn('Failed to fetch role permissions, using defaults:', permError);
        }

        setUser(result.user);
        // Sync to Redux with token
        syncToRedux(result.user, result.token);
        return { success: true };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = 'Échec de connexion. Veuillez réessayer.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      const result = await authService.register(userData);
      if (result.success) {
        setUser(result.user);
        // Sync to Redux with token
        syncToRedux(result.user, result.token);
        return { success: true };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = 'Échec de l\'inscription. Veuillez réessayer.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await authService.logout();
      setUser(null);
      // Sync to Redux
      syncToRedux(null);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, clear local state
      setUser(null);
      // Sync to Redux
      syncToRedux(null);
      return { success: true };
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (updates) => {
    try {
      setLoading(true);
      setError(null);
      const result = await authService.updateDetails(updates);
      if (result.success) {
        setUser(result.user);
        return { success: true };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = 'Échec de la mise à jour. Veuillez réessayer.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (passwords) => {
    try {
      setLoading(true);
      setError(null);
      const result = await authService.updatePassword(passwords);
      if (result.success) {
        return { success: true };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = 'Échec du changement de mot de passe. Veuillez réessayer.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const hasRole = (roles) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (typeof roles === 'string') {
      return user.role === roles;
    }
    return roles.includes(user.role);
  };

  const hasPermission = (module, action) => {
    if (!user) return false;
    if (user.role === 'admin') return true;

    const permission = user.permissions?.find(p => p.module === module);
    return permission && permission.actions.includes(action);
  };

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    updateUser,
    updatePassword,
    checkAuth,
    hasRole,
    hasPermission,
    clearError: () => setError(null)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};