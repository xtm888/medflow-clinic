import api from './apiConfig';
import databaseService from './database';
import clinicSyncService from './clinicSyncService';

const authService = {
  // Login user
  // SECURITY: Tokens are now stored in HttpOnly cookies (XSS-safe)
  async login(credentials) {
    try {
      const response = await api.post('/auth/login', credentials);
      if (response.data.success) {
        const { user } = response.data;
        // SECURITY: Token stored in HttpOnly cookie by server, not in localStorage
        // Only store non-sensitive user info for UI display
        localStorage.setItem('user', JSON.stringify(user));
        return { success: true, user };
      }
      return { success: false, error: response.data.error };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  },

  // Register user
  // SECURITY: Tokens are now stored in HttpOnly cookies (XSS-safe)
  async register(userData) {
    try {
      const response = await api.post('/auth/register', userData);
      if (response.data.success) {
        const { user } = response.data;
        // SECURITY: Token stored in HttpOnly cookie by server, not in localStorage
        // Only store non-sensitive user info for UI display
        localStorage.setItem('user', JSON.stringify(user));
        return { success: true, user };
      }
      return { success: false, error: response.data.error };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed'
      };
    }
  },

  // Logout user
  // CRITICAL: Complete data cleanup to prevent data leakage
  async logout() {
    try {
      // SECURITY: Server clears HttpOnly cookies
      await api.post('/auth/logout');
    } catch (error) {
      console.warn('[Auth] Server logout failed:', error.message);
    }

    // CRITICAL: Clear ALL sensitive local data on logout
    try {
      // 1. Clear user info (tokens cleared by server via HttpOnly cookies)
      localStorage.removeItem('user');

      // 2. Clear clinic selection data
      localStorage.removeItem('medflow_selected_clinic');
      localStorage.removeItem('medflow_active_clinic_id');
      localStorage.removeItem('medflow_last_sync');
      localStorage.removeItem('medflow_sync_status');

      // 3. Clear redux-persist data
      localStorage.removeItem('persist:root');

      // 4. Clear any cached patient data
      localStorage.removeItem('medflow_recent_patients');
      localStorage.removeItem('medflow_patient_cache');

      // 5. Clear clinic sync service state
      clinicSyncService.setActiveClinic(null);

      // 6. Clear IndexedDB data (async, but don't block logout)
      databaseService.clearAll().catch(err => {
        console.error('[Auth] Failed to clear IndexedDB:', err);
      });

      console.log('[Auth] Complete logout cleanup performed');
    } catch (cleanupError) {
      console.error('[Auth] Logout cleanup failed:', cleanupError);
    }

    return { success: true };
  },

  // Get current user
  async getCurrentUser() {
    try {
      const response = await api.get('/auth/me');
      if (response.data.success) {
        const user = response.data.data;
        localStorage.setItem('user', JSON.stringify(user));
        return { success: true, user };
      }
      return { success: false };
    } catch (error) {
      return { success: false };
    }
  },

  // Update user details
  async updateDetails(details) {
    try {
      const response = await api.put('/auth/updatedetails', details);
      if (response.data.success) {
        const user = response.data.data;
        localStorage.setItem('user', JSON.stringify(user));
        return { success: true, user };
      }
      return { success: false, error: response.data.error };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Update failed'
      };
    }
  },

  // Update password
  async updatePassword(passwords) {
    try {
      const response = await api.put('/auth/updatepassword', passwords);
      if (response.data.success) {
        return { success: true };
      }
      return { success: false, error: response.data.error };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Password update failed'
      };
    }
  },

  // Forgot password
  async forgotPassword(email) {
    try {
      const response = await api.post('/auth/forgotpassword', { email });
      return {
        success: response.data.success,
        message: response.data.message || response.data.error
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.error || 'Request failed'
      };
    }
  },

  // Reset password
  async resetPassword(token, password) {
    try {
      const response = await api.put(`/auth/resetpassword/${token}`, {
        password
      });
      return {
        success: response.data.success,
        message: response.data.message || response.data.error
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.error || 'Reset failed'
      };
    }
  },

  // Verify email
  async verifyEmail(token) {
    try {
      const response = await api.get(`/auth/verifyemail/${token}`);
      return {
        success: response.data.success,
        message: response.data.message || response.data.error
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.error || 'Verification failed'
      };
    }
  },

  // Check if user is logged in
  // SECURITY: Token is in HttpOnly cookie (can't access via JS), so check user data presence
  // The actual auth check happens server-side via the cookie
  isAuthenticated() {
    const user = localStorage.getItem('user');
    return !!user;
  },

  // Get stored user
  getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  // Get user role
  getUserRole() {
    const user = this.getUser();
    return user?.role || null;
  },

  // Check if user has permission
  hasPermission(requiredRoles) {
    const userRole = this.getUserRole();
    if (!userRole) return false;
    if (userRole === 'admin') return true;
    return requiredRoles.includes(userRole);
  },

  // Get role permissions from database
  async getRolePermissions() {
    try {
      const response = await api.get('/role-permissions/me');
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      }
      return { success: false, error: response.data.error };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch permissions'
      };
    }
  }
};

export default authService;