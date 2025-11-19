import api from './apiConfig';

// User management service
const userService = {
  // Get all users
  async getAll(params = {}) {
    try {
      const response = await api.get('/users', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },

  // Get single user
  async getById(id) {
    try {
      const response = await api.get(`/users/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    }
  },

  // Create new user
  async create(userData) {
    try {
      const response = await api.post('/users', userData);
      return response.data;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  // Update user
  async update(id, userData) {
    try {
      const response = await api.put(`/users/${id}`, userData);
      return response.data;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  // Delete user
  async delete(id) {
    try {
      const response = await api.delete(`/users/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },

  // Activate user
  async activate(id) {
    try {
      const response = await api.put(`/users/${id}/activate`);
      return response.data;
    } catch (error) {
      console.error('Error activating user:', error);
      throw error;
    }
  },

  // Deactivate user
  async deactivate(id) {
    try {
      const response = await api.put(`/users/${id}/deactivate`);
      return response.data;
    } catch (error) {
      console.error('Error deactivating user:', error);
      throw error;
    }
  },

  // Reset user password
  async resetPassword(id) {
    try {
      const response = await api.post(`/users/${id}/reset-password`);
      return response.data;
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  },

  // Update user role
  async updateRole(id, role) {
    try {
      const response = await api.put(`/users/${id}/role`, { role });
      return response.data;
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  },

  // Get users by role
  async getByRole(role) {
    try {
      const response = await api.get('/users', {
        params: { role }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching users by role:', error);
      throw error;
    }
  },

  // Search users
  async search(query) {
    try {
      const response = await api.get('/users/search', {
        params: { q: query }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  },

  // Get active users
  async getActive() {
    try {
      const response = await api.get('/users', {
        params: { isActive: true }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching active users:', error);
      throw error;
    }
  },

  // Update user permissions
  async updatePermissions(id, permissions) {
    try {
      const response = await api.put(`/users/${id}/permissions`, { permissions });
      return response.data;
    } catch (error) {
      console.error('Error updating permissions:', error);
      throw error;
    }
  }
};

export default userService;
