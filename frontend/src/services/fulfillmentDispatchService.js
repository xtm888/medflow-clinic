import api from './apiConfig';

const BASE_URL = '/fulfillment-dispatches';

/**
 * Fulfillment Dispatch Service
 * Unified tracking for all external service dispatches
 */
const fulfillmentDispatchService = {
  // Get all dispatches with filters
  getAll: async (params = {}) => {
    const response = await api.get(BASE_URL, { params });
    return response.data;
  },

  // Get single dispatch by ID
  getById: async (id) => {
    const response = await api.get(`${BASE_URL}/${id}`);
    return response.data;
  },

  // Create new dispatch
  create: async (data) => {
    const response = await api.post(BASE_URL, data);
    return response.data;
  },

  // Update dispatch status
  updateStatus: async (id, status, notes) => {
    const response = await api.put(`${BASE_URL}/${id}/status`, { status, notes });
    return response.data;
  },

  // Mark as dispatched
  markDispatched: async (id, dispatchData) => {
    const response = await api.post(`${BASE_URL}/${id}/dispatch`, dispatchData);
    return response.data;
  },

  // Record acknowledgment
  recordAcknowledgment: async (id, ackData) => {
    const response = await api.post(`${BASE_URL}/${id}/acknowledge`, ackData);
    return response.data;
  },

  // Confirm completion
  confirmCompletion: async (id, completionData) => {
    const response = await api.post(`${BASE_URL}/${id}/complete`, completionData);
    return response.data;
  },

  // Get pending dispatches
  getPending: async (params = {}) => {
    const response = await api.get(`${BASE_URL}/pending`, { params });
    return response.data;
  },

  // Get overdue dispatches
  getOverdue: async (params = {}) => {
    const response = await api.get(`${BASE_URL}/overdue`, { params });
    return response.data;
  },

  // Get stats
  getStats: async (params = {}) => {
    const response = await api.get(`${BASE_URL}/stats`, { params });
    return response.data;
  },

  // Get patient dispatches
  getPatientDispatches: async (patientId) => {
    const response = await api.get(`${BASE_URL}/patient/${patientId}`);
    return response.data;
  },

  // Add reminder
  addReminder: async (id, reminderData) => {
    const response = await api.post(`${BASE_URL}/${id}/reminder`, reminderData);
    return response.data;
  },

  // Get dashboard data
  getDashboard: async (params = {}) => {
    const response = await api.get(`${BASE_URL}/dashboard`, { params });
    return response.data;
  },

  // Source type options
  sourceTypes: [
    { value: 'invoice_item', label: 'Article de facture' },
    { value: 'prescription', label: 'Ordonnance' },
    { value: 'lab_order', label: 'Analyse labo' },
    { value: 'imaging_order', label: 'Imagerie' },
    { value: 'surgery_referral', label: 'Chirurgie' },
    { value: 'glasses_order', label: 'Lunettes' },
    { value: 'therapy_referral', label: 'Rééducation' },
    { value: 'specialist_referral', label: 'Spécialiste' }
  ],

  // Status options
  statusOptions: [
    { value: 'pending', label: 'En attente', color: 'gray' },
    { value: 'dispatched', label: 'Envoyé', color: 'blue' },
    { value: 'acknowledged', label: 'Confirmé', color: 'indigo' },
    { value: 'in_progress', label: 'En cours', color: 'yellow' },
    { value: 'completed', label: 'Terminé', color: 'green' },
    { value: 'cancelled', label: 'Annulé', color: 'red' },
    { value: 'failed', label: 'Échec', color: 'red' },
    { value: 'returned', label: 'Retourné', color: 'orange' }
  ],

  // Priority options
  priorityOptions: [
    { value: 'routine', label: 'Routine', color: 'gray' },
    { value: 'urgent', label: 'Urgent', color: 'yellow' },
    { value: 'stat', label: 'STAT', color: 'red' },
    { value: 'asap', label: 'ASAP', color: 'orange' }
  ],

  // Dispatch method options
  dispatchMethods: [
    { value: 'email', label: 'Email' },
    { value: 'fax', label: 'Fax' },
    { value: 'api', label: 'API' },
    { value: 'print', label: 'Impression' },
    { value: 'sms', label: 'SMS' },
    { value: 'portal', label: 'Portail' },
    { value: 'manual', label: 'Manuel' }
  ],

  // Get status label and color
  getStatusInfo: (status) => {
    const found = fulfillmentDispatchService.statusOptions.find(s => s.value === status);
    return found || { label: status, color: 'gray' };
  },

  // Get source type label
  getSourceTypeLabel: (type) => {
    const found = fulfillmentDispatchService.sourceTypes.find(t => t.value === type);
    return found ? found.label : type;
  },

  // Get priority info
  getPriorityInfo: (priority) => {
    const found = fulfillmentDispatchService.priorityOptions.find(p => p.value === priority);
    return found || { label: priority, color: 'gray' };
  }
};

export default fulfillmentDispatchService;
