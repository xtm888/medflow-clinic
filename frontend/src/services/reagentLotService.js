import api from './apiConfig';

const BASE_URL = '/reagent-lots';

/**
 * Reagent Lot Service
 * Gestion des lots de réactifs
 */

export const reagentLotService = {
  // Get all reagent lots
  getReagentLots: async (params = {}) => {
    const response = await api.get(BASE_URL, { params });
    return response.data;
  },

  // Get single reagent lot
  getReagentLot: async (id) => {
    const response = await api.get(`${BASE_URL}/${id}`);
    return response.data;
  },

  // Create reagent lot
  createReagentLot: async (data) => {
    const response = await api.post(BASE_URL, data);
    return response.data;
  },

  // Update reagent lot
  updateReagentLot: async (id, data) => {
    const response = await api.put(`${BASE_URL}/${id}`, data);
    return response.data;
  },

  // Delete reagent lot
  deleteReagentLot: async (id) => {
    const response = await api.delete(`${BASE_URL}/${id}`);
    return response.data;
  },

  // Get stats
  getStats: async () => {
    const response = await api.get(`${BASE_URL}/stats`);
    return response.data;
  },

  // Get lots expiring soon
  getExpiringSoon: async (days = 30) => {
    const response = await api.get(`${BASE_URL}/expiring-soon`, {
      params: { days }
    });
    return response.data;
  },

  // Get lots pending validation
  getPendingValidation: async () => {
    const response = await api.get(`${BASE_URL}/pending-validation`);
    return response.data;
  },

  // Get active lot for test
  getActiveLot: async (analyzerId, testCode) => {
    const response = await api.get(`${BASE_URL}/active/${analyzerId}/${testCode}`);
    return response.data;
  },

  // Get reference range for patient
  getReferenceRange: async (lotId, patientAge, patientGender) => {
    const response = await api.get(`${BASE_URL}/${lotId}/reference-range`, {
      params: { patientAge, patientGender }
    });
    return response.data;
  },

  // Validation workflow
  addValidationResult: async (lotId, result) => {
    const response = await api.post(`${BASE_URL}/${lotId}/validation-results`, result);
    return response.data;
  },

  completeValidation: async (lotId, approved, notes) => {
    const response = await api.post(`${BASE_URL}/${lotId}/complete-validation`, {
      approved,
      notes
    });
    return response.data;
  },

  waiveValidation: async (lotId, reason) => {
    const response = await api.post(`${BASE_URL}/${lotId}/waive-validation`, { reason });
    return response.data;
  },

  // Activation
  activateLot: async (lotId, setAsActiveOnAnalyzer = true) => {
    const response = await api.post(`${BASE_URL}/${lotId}/activate`, {
      setAsActiveOnAnalyzer
    });
    return response.data;
  },

  deactivateLot: async (lotId, reason) => {
    const response = await api.post(`${BASE_URL}/${lotId}/deactivate`, { reason });
    return response.data;
  },

  // Usage tracking
  recordUsage: async (lotId, count = 1) => {
    const response = await api.post(`${BASE_URL}/${lotId}/record-usage`, { count });
    return response.data;
  }
};

// Constants
export const LOT_STATUSES = [
  { value: 'received', label: 'Reçu', color: 'gray' },
  { value: 'validating', label: 'En validation', color: 'yellow' },
  { value: 'validated', label: 'Validé', color: 'blue' },
  { value: 'active', label: 'Actif', color: 'green' },
  { value: 'depleted', label: 'Épuisé', color: 'orange' },
  { value: 'expired', label: 'Expiré', color: 'red' },
  { value: 'rejected', label: 'Rejeté', color: 'red' }
];

export const VALIDATION_STATUSES = [
  { value: 'pending', label: 'En attente', color: 'gray' },
  { value: 'in-progress', label: 'En cours', color: 'yellow' },
  { value: 'passed', label: 'Réussi', color: 'green' },
  { value: 'failed', label: 'Échoué', color: 'red' },
  { value: 'waived', label: 'Dispensé', color: 'blue' }
];

export const VALIDATION_METHODS = [
  { value: 'manufacturer-verification', label: 'Vérification fabricant' },
  { value: 'parallel-testing', label: 'Tests parallèles' },
  { value: 'qc-only', label: 'QC uniquement' },
  { value: 'waived', label: 'Dispensé' }
];

export const STOCK_UNITS = [
  { value: 'tests', label: 'Tests' },
  { value: 'ml', label: 'mL' },
  { value: 'units', label: 'Unités' },
  { value: 'kits', label: 'Kits' }
];

export default reagentLotService;
