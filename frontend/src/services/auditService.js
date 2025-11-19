import api from './apiConfig';

// Audit service for viewing system audit logs
const auditService = {
  // Get audit logs with filters
  async getLogs(params = {}) {
    try {
      const response = await api.get('/audit', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      throw error;
    }
  },

  // Get logs by user
  async getByUser(userId, params = {}) {
    try {
      const response = await api.get('/audit', {
        params: { userId, ...params }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching user audit logs:', error);
      throw error;
    }
  },

  // Get logs by action type
  async getByAction(action, params = {}) {
    try {
      const response = await api.get('/audit', {
        params: { action, ...params }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching audit logs by action:', error);
      throw error;
    }
  },

  // Get logs by resource
  async getByResource(resource, params = {}) {
    try {
      const response = await api.get('/audit', {
        params: { resource, ...params }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching audit logs by resource:', error);
      throw error;
    }
  },

  // Get logs by date range
  async getByDateRange(startDate, endDate, params = {}) {
    try {
      const response = await api.get('/audit', {
        params: { startDate, endDate, ...params }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching audit logs by date:', error);
      throw error;
    }
  },

  // Get patient data access logs (HIPAA compliance)
  async getPatientAccessLogs(patientId, params = {}) {
    try {
      const response = await api.get('/audit', {
        params: {
          action: 'PATIENT_DATA_ACCESS',
          'metadata.patientId': patientId,
          ...params
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching patient access logs:', error);
      throw error;
    }
  },

  // Get login attempts
  async getLoginAttempts(params = {}) {
    try {
      const response = await api.get('/audit', {
        params: {
          action: { $in: ['LOGIN_SUCCESS', 'LOGIN_FAILED'] },
          ...params
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching login attempts:', error);
      throw error;
    }
  },

  // Get critical operations
  async getCriticalOperations(params = {}) {
    try {
      const response = await api.get('/audit', {
        params: {
          action: { $regex: 'CRITICAL' },
          ...params
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching critical operations:', error);
      throw error;
    }
  },

  // Export audit report
  async exportReport(params = {}) {
    try {
      const response = await api.get('/audit/export', {
        params,
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting audit report:', error);
      throw error;
    }
  },

  // Get audit statistics
  async getStats(params = {}) {
    try {
      const response = await api.get('/audit/stats', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching audit stats:', error);
      throw error;
    }
  },

  // Get available action types
  async getActionTypes() {
    return [
      'LOGIN_SUCCESS',
      'LOGIN_FAILED',
      'DATA_ACCESS',
      'DATA_CREATE',
      'DATA_UPDATE',
      'DATA_DELETE',
      'PATIENT_DATA_ACCESS',
      'PRESCRIPTION_CREATE',
      'PRESCRIPTION_UPDATE',
      'PRESCRIPTION_DELETE',
      'PRESCRIPTION_DISPENSE',
      'PRESCRIPTION_VERIFY',
      'PRESCRIPTION_VIEW',
      'CRITICAL_DATA_EXPORT',
      'CRITICAL_BULK_DELETE',
      'CRITICAL_PERMISSION_CHANGE',
      'CRITICAL_USER_ROLE_CHANGE',
      'CRITICAL_SYSTEM_CONFIG_CHANGE'
    ];
  }
};

export default auditService;
