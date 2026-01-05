import api from './apiConfig';

const feeScheduleService = {
  /**
   * Get all fee schedules with optional filtering
   * @param {Object} params - Query parameters
   * @param {string} params.category - Filter by category (e.g., 'medication', 'laboratory', 'imaging')
   * @param {string} params.department - Filter by department
   * @param {string} params.search - Search term
   * @returns {Promise<Array>} Array of fee schedules
   */
  async getFeeSchedules(params = {}) {
    try {
      const response = await api.get('/fee-schedules', { params });
      // Safely extract array from various API response formats
      const rawData = response?.data?.data ?? response?.data ?? [];
      return Array.isArray(rawData) ? rawData : [];
    } catch (error) {
      console.error('Error fetching fee schedules:', error);
      throw error;
    }
  },

  /**
   * Get fee schedules by category
   * @param {string} category - Category to filter by
   * @returns {Promise<Array>} Array of fee schedules
   */
  async getByCategory(category) {
    return this.getFeeSchedules({ category });
  },

  /**
   * Get medications (fee schedules with category 'medication')
   * @returns {Promise<Array>} Array of medications
   */
  async getMedications() {
    return this.getFeeSchedules({ category: 'medication' });
  },

  /**
   * Get imaging/examination procedures
   * @returns {Promise<Array>} Array of imaging/exam services
   */
  async getImagingExams() {
    try {
      const response = await api.get('/fee-schedules', {
        params: {
          // Get imaging, functional, and examination categories
          search: '' // Get all
        }
      });

      // Safely extract array from various API response formats
      const rawServices = response?.data?.data ?? response?.data ?? [];
      const allServices = Array.isArray(rawServices) ? rawServices : [];

      // Filter for imaging and examination related services
      return allServices.filter(service =>
        service.category === 'Imaging' ||
        service.category === 'Functional' ||
        service.category === 'Examination' ||
        service.category === 'Preop' ||
        service.displayCategory === 'Imaging' ||
        service.displayCategory === 'Functional'
      );
    } catch (error) {
      console.error('Error fetching imaging exams:', error);
      throw error;
    }
  },

  /**
   * Get surgery acts (chirurgie)
   * @returns {Promise<Array>} Array of surgery services
   */
  async getSurgeryActs() {
    try {
      const response = await api.get('/fee-schedules', {
        params: {
          search: '' // Get all
        }
      });

      // Safely extract array from various API response formats
      const rawServices = response?.data?.data ?? response?.data ?? [];
      const allServices = Array.isArray(rawServices) ? rawServices : [];

      // Filter for surgery services
      return allServices.filter(service =>
        service.category === 'surgery' ||
        service.category === 'Surgery' ||
        service.displayCategory === 'Surgery' ||
        service.displayCategory === 'Chirurgie'
      );
    } catch (error) {
      console.error('Error fetching surgery acts:', error);
      throw error;
    }
  },

  /**
   * Get laboratory tests
   * @returns {Promise<Array>} Array of lab tests
   */
  async getLabTests() {
    try {
      const response = await api.get('/fee-schedules', {
        params: {
          search: '' // Get all
        }
      });

      // Safely extract array from various API response formats
      const rawServices = response?.data?.data ?? response?.data ?? [];
      const allServices = Array.isArray(rawServices) ? rawServices : [];

      // Filter for laboratory services
      return allServices.filter(service =>
        service.category === 'Laboratory' ||
        service.displayCategory === 'Laboratory'
      );
    } catch (error) {
      console.error('Error fetching lab tests:', error);
      throw error;
    }
  },

  /**
   * Get single fee schedule by code
   * @param {string} code - Fee schedule code
   * @returns {Promise<Object>} Fee schedule object
   */
  async getByCode(code) {
    try {
      const response = await api.get(`/fee-schedules/${code}`);
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching fee schedule ${code}:`, error);
      throw error;
    }
  },

  /**
   * Get all unique categories
   * @returns {Promise<Array>} Array of category strings
   */
  async getCategories() {
    try {
      const response = await api.get('/fee-schedules/categories');
      // Safely extract array from various API response formats
      const rawCategories = response?.data?.data ?? response?.data ?? [];
      return Array.isArray(rawCategories) ? rawCategories : [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  },

  // ==========================================
  // CRUD OPERATIONS (Admin/Billing)
  // ==========================================

  /**
   * Get all fee schedules for management (includes inactive)
   * @param {Object} params - Query parameters
   * @param {string} params.category - Filter by category
   * @param {string} params.search - Search term
   * @param {boolean} params.active - Filter by active status
   * @returns {Promise<Object>} Response with data array
   */
  async getAllForManagement(params = {}) {
    try {
      const response = await api.get('/billing/fee-schedule', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching fee schedules for management:', error);
      throw error;
    }
  },

  /**
   * Create a new fee schedule item
   * @param {Object} data - Fee schedule data
   * @returns {Promise<Object>} Created fee schedule
   */
  async createFeeSchedule(data) {
    try {
      const response = await api.post('/billing/fee-schedule', data);
      return response.data;
    } catch (error) {
      console.error('Error creating fee schedule:', error);
      throw error;
    }
  },

  /**
   * Update an existing fee schedule item
   * @param {string} id - Fee schedule ID
   * @param {Object} data - Updated fee schedule data
   * @returns {Promise<Object>} Updated fee schedule
   */
  async updateFeeSchedule(id, data) {
    try {
      const response = await api.put(`/billing/fee-schedule/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating fee schedule:', error);
      throw error;
    }
  },

  /**
   * Delete (deactivate) a fee schedule item
   * @param {string} id - Fee schedule ID
   * @returns {Promise<Object>} Response
   */
  async deleteFeeSchedule(id) {
    try {
      const response = await api.delete(`/billing/fee-schedule/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting fee schedule:', error);
      throw error;
    }
  },

  /**
   * Reactivate a deactivated fee schedule item
   * @param {string} id - Fee schedule ID
   * @returns {Promise<Object>} Updated fee schedule
   */
  async reactivateFeeSchedule(id) {
    try {
      const response = await api.put(`/billing/fee-schedule/${id}`, { active: true });
      return response.data;
    } catch (error) {
      console.error('Error reactivating fee schedule:', error);
      throw error;
    }
  },

  // ==========================================
  // MULTI-CLINIC OPERATIONS
  // ==========================================

  /**
   * Get fee schedules for a specific clinic
   * @param {string} clinicId - Clinic ID
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Response with data array
   */
  async getForClinic(clinicId, params = {}) {
    try {
      const response = await api.get('/billing/fee-schedule', {
        params: { ...params, clinic: clinicId }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching clinic fee schedules:', error);
      throw error;
    }
  },

  /**
   * Get template fee schedules (central/base prices)
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Response with data array
   */
  async getTemplates(params = {}) {
    try {
      const response = await api.get('/billing/fee-schedule/templates', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching template fee schedules:', error);
      throw error;
    }
  },

  /**
   * Get clinic pricing status (completeness check)
   * @param {Array<string>} clinicIds - Optional array of clinic IDs
   * @returns {Promise<Object>} Response with status data
   */
  async getClinicPricingStatus(clinicIds = []) {
    try {
      const params = clinicIds.length > 0 ? { clinics: clinicIds.join(',') } : {};
      const response = await api.get('/billing/fee-schedule/clinic-status', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching clinic pricing status:', error);
      throw error;
    }
  },

  /**
   * Copy fee schedules to a clinic
   * @param {string|null} sourceClinic - Source clinic ID (null for templates)
   * @param {string} targetClinic - Target clinic ID
   * @param {boolean} overwrite - Whether to overwrite existing prices
   * @returns {Promise<Object>} Response with copy results
   */
  async copyToClinic(sourceClinic, targetClinic, overwrite = false) {
    try {
      const response = await api.post('/billing/fee-schedule/copy-to-clinic', {
        sourceClinic,
        targetClinic,
        overwrite
      });
      return response.data;
    } catch (error) {
      console.error('Error copying fee schedules:', error);
      throw error;
    }
  }
};

export default feeScheduleService;
