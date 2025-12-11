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
  async getStats(period = '24h') {
    try {
      const response = await api.get('/audit/stats', { params: { period } });
      return response.data;
    } catch (error) {
      console.error('Error fetching audit stats:', error);
      throw error;
    }
  },

  // Get suspicious activities
  async getSuspicious(hours = 24) {
    try {
      const response = await api.get('/audit/suspicious', { params: { hours } });
      return response.data;
    } catch (error) {
      console.error('Error fetching suspicious activities:', error);
      throw error;
    }
  },

  // Get user activity by user ID
  async getUserActivity(userId, params = {}) {
    try {
      const response = await api.get(`/audit/user/${userId}`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching user activity:', error);
      throw error;
    }
  },

  // Get patient audit trail
  async getPatientAuditTrail(patientId, params = {}) {
    try {
      const response = await api.get(`/audit/patient/${patientId}`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching patient audit trail:', error);
      throw error;
    }
  },

  // Get compliance report
  async getComplianceReport(startDate, endDate, type = 'hipaa') {
    try {
      const response = await api.get('/audit/compliance', {
        params: { startDate, endDate, type }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching compliance report:', error);
      throw error;
    }
  },

  // Get available action types from backend
  async getActionTypes() {
    try {
      const response = await api.get('/audit/actions');
      return response.data;
    } catch (error) {
      console.error('Error fetching action types:', error);
      // Fallback to static list
      return {
        success: true,
        data: [
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
        ]
      };
    }
  },

  // ============================================
  // EMPLOYEE ACTIVITY TRACKING
  // ============================================

  // Get all employees' activity summary
  async getEmployeeActivity(params = {}) {
    try {
      const response = await api.get('/audit/employees', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching employee activity:', error);
      throw error;
    }
  },

  // Get specific employee's daily activity breakdown
  async getEmployeeDailyActivity(userId, params = {}) {
    try {
      const response = await api.get(`/audit/employees/${userId}/daily`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching employee daily activity:', error);
      throw error;
    }
  },

  // Get all login history
  async getLoginHistory(params = {}) {
    try {
      const response = await api.get('/audit/logins', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching login history:', error);
      throw error;
    }
  },

  // Get all data modifications (creates, updates, deletes)
  async getDataModifications(params = {}) {
    try {
      const response = await api.get('/audit/modifications', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching data modifications:', error);
      throw error;
    }
  },

  // Get critical operations
  async getCriticalOps(params = {}) {
    try {
      const response = await api.get('/audit/critical', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching critical operations:', error);
      throw error;
    }
  },

  // Export audit logs to CSV
  async exportToCSV(params = {}) {
    try {
      const response = await api.get('/audit/export', {
        params,
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      throw error;
    }
  },

  // Get hourly activity timeline
  async getTimeline(params = {}) {
    try {
      const response = await api.get('/audit/timeline', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching timeline:', error);
      throw error;
    }
  },

  // Mark audit log as reviewed
  async markReviewed(logId, notes = '') {
    try {
      const response = await api.put(`/audit/${logId}/review`, { notes });
      return response.data;
    } catch (error) {
      console.error('Error marking as reviewed:', error);
      throw error;
    }
  },

  // Add admin note to audit log
  async addNote(logId, note) {
    try {
      const response = await api.post(`/audit/${logId}/note`, { note });
      return response.data;
    } catch (error) {
      console.error('Error adding note:', error);
      throw error;
    }
  }
};

export default auditService;
