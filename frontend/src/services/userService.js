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
  },

  // ============================================
  // FAVORITE MEDICATIONS - StudioVision Parity
  // ============================================

  /**
   * Get current user's favorite medications
   */
  async getFavoriteMedications() {
    try {
      const response = await api.get('/users/me/favorites/medications');
      return response.data;
    } catch (error) {
      console.error('Error fetching favorite medications:', error);
      throw error;
    }
  },

  /**
   * Add medication to favorites
   */
  async addFavoriteMedication(medicationData) {
    try {
      const response = await api.post('/users/me/favorites/medications', medicationData);
      // Update local storage user data
      this.updateLocalUserPreferences(response.data);
      return response.data;
    } catch (error) {
      console.error('Error adding favorite medication:', error);
      throw error;
    }
  },

  /**
   * Remove medication from favorites
   */
  async removeFavoriteMedication(medicationId) {
    try {
      const response = await api.delete(`/users/me/favorites/medications/${medicationId}`);
      this.updateLocalUserPreferences(response.data);
      return response.data;
    } catch (error) {
      console.error('Error removing favorite medication:', error);
      throw error;
    }
  },

  /**
   * Reorder favorite medications
   */
  async reorderFavoriteMedications(orderedIds) {
    try {
      const response = await api.put('/users/me/favorites/medications/reorder', { orderedIds });
      this.updateLocalUserPreferences(response.data);
      return response.data;
    } catch (error) {
      console.error('Error reordering favorite medications:', error);
      throw error;
    }
  },

  /**
   * Update default dosage for a favorite medication
   */
  async updateFavoriteMedicationDosage(medicationId, dosage) {
    try {
      const response = await api.put(`/users/me/favorites/medications/${medicationId}/dosage`, dosage);
      this.updateLocalUserPreferences(response.data);
      return response.data;
    } catch (error) {
      console.error('Error updating favorite medication dosage:', error);
      throw error;
    }
  },

  /**
   * Record usage of a favorite (for analytics/sorting)
   */
  async recordFavoriteUsage(medicationId) {
    try {
      await api.post(`/users/me/favorites/medications/${medicationId}/use`);
    } catch (error) {
      // Non-critical, don't throw
      console.warn('Failed to record favorite usage:', error);
    }
  },

  // ============================================
  // USER PREFERENCES - StudioVision Parity
  // ============================================

  /**
   * Get user preferences
   */
  async getPreferences() {
    try {
      const response = await api.get('/users/me/preferences');
      return response.data;
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      throw error;
    }
  },

  /**
   * Update user preferences
   */
  async updatePreferences(preferences) {
    try {
      const response = await api.put('/users/me/preferences', preferences);
      this.updateLocalUserPreferences(response.data);
      return response.data;
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw error;
    }
  },

  /**
   * Update view preference (compact/expanded/clinical)
   */
  async updateViewPreference(viewPreference) {
    return this.updatePreferences({ viewPreference });
  },

  /**
   * Update dashboard layout preference
   */
  async updateDashboardLayout(dashboardLayout) {
    return this.updatePreferences({ dashboardLayout });
  },

  /**
   * Helper: Update local storage user data with new preferences
   */
  updateLocalUserPreferences(preferencesData) {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        user.preferences = { ...user.preferences, ...preferencesData?.preferences };
        localStorage.setItem('user', JSON.stringify(user));
      }
    } catch (e) {
      console.warn('Failed to update local user preferences:', e);
    }
  }
};

export default userService;
