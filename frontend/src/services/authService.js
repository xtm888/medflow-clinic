import api from './apiConfig';

const authService = {
  // Login user
  async login(credentials) {
    try {
      const response = await api.post('/auth/login', credentials);
      if (response.data.success) {
        const { token, user } = response.data;
        localStorage.setItem('token', token);
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
  async register(userData) {
    try {
      const response = await api.post('/auth/register', userData);
      if (response.data.success) {
        const { token, user } = response.data;
        localStorage.setItem('token', token);
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
  async logout() {
    try {
      await api.post('/auth/logout');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return { success: true };
    } catch (error) {
      // Even if logout fails on server, clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return { success: true };
    }
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
  isAuthenticated() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return !!(token && user);
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
  }
};

export default authService;