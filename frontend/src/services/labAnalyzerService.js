import api from './apiConfig';

const BASE_URL = '/lab-analyzers';

/**
 * Lab Analyzer Service
 * Gestion des analyseurs de laboratoire
 */

export const labAnalyzerService = {
  // Get all analyzers
  getAnalyzers: async (params = {}) => {
    const response = await api.get(BASE_URL, { params });
    return response.data;
  },

  // Get single analyzer
  getAnalyzer: async (id) => {
    const response = await api.get(`${BASE_URL}/${id}`);
    return response.data;
  },

  // Create analyzer
  createAnalyzer: async (data) => {
    const response = await api.post(BASE_URL, data);
    return response.data;
  },

  // Update analyzer
  updateAnalyzer: async (id, data) => {
    const response = await api.put(`${BASE_URL}/${id}`, data);
    return response.data;
  },

  // Delete analyzer
  deleteAnalyzer: async (id) => {
    const response = await api.delete(`${BASE_URL}/${id}`);
    return response.data;
  },

  // Get analyzers for specific test
  getAnalyzersForTest: async (testCode) => {
    const response = await api.get(`${BASE_URL}/for-test/${testCode}`);
    return response.data;
  },

  // Get analyzer stats
  getStats: async () => {
    const response = await api.get(`${BASE_URL}/stats`);
    return response.data;
  },

  // Add supported test
  addSupportedTest: async (analyzerId, testData) => {
    const response = await api.post(`${BASE_URL}/${analyzerId}/tests`, testData);
    return response.data;
  },

  // Remove supported test
  removeSupportedTest: async (analyzerId, testCode) => {
    const response = await api.delete(`${BASE_URL}/${analyzerId}/tests/${testCode}`);
    return response.data;
  },

  // Update status
  updateStatus: async (analyzerId, status, notes) => {
    const response = await api.put(`${BASE_URL}/${analyzerId}/status`, { status, notes });
    return response.data;
  },

  // Set active reagent lot
  setActiveReagentLot: async (analyzerId, testCode, reagentLotId) => {
    const response = await api.post(`${BASE_URL}/${analyzerId}/active-lot`, {
      testCode,
      reagentLotId
    });
    return response.data;
  }
};

// Constants
export const ANALYZER_TYPES = [
  { value: 'chemistry', label: 'Biochimie' },
  { value: 'hematology', label: 'Hématologie' },
  { value: 'coagulation', label: 'Coagulation' },
  { value: 'immunoassay', label: 'Immunologie' },
  { value: 'urinalysis', label: 'Analyse d\'urine' },
  { value: 'blood-gas', label: 'Gaz du sang' },
  { value: 'microbiology', label: 'Microbiologie' },
  { value: 'molecular', label: 'Biologie moléculaire' },
  { value: 'point-of-care', label: 'Point of Care' },
  { value: 'multi-discipline', label: 'Multi-disciplinaire' }
];

export const ANALYZER_MANUFACTURERS = [
  { value: 'Roche', label: 'Roche' },
  { value: 'Siemens', label: 'Siemens' },
  { value: 'Abbott', label: 'Abbott' },
  { value: 'Beckman Coulter', label: 'Beckman Coulter' },
  { value: 'Sysmex', label: 'Sysmex' },
  { value: 'Bio-Rad', label: 'Bio-Rad' },
  { value: 'Ortho Clinical', label: 'Ortho Clinical' },
  { value: 'Werfen', label: 'Werfen' },
  { value: 'Horiba', label: 'Horiba' },
  { value: 'Mindray', label: 'Mindray' },
  { value: 'Stago', label: 'Stago' },
  { value: 'Radiometer', label: 'Radiometer' },
  { value: 'Instrumentation Laboratory', label: 'Instrumentation Laboratory' },
  { value: 'Autre', label: 'Autre' }
];

export const ANALYZER_STATUSES = [
  { value: 'active', label: 'Actif', color: 'green' },
  { value: 'maintenance', label: 'Maintenance', color: 'yellow' },
  { value: 'calibrating', label: 'Calibration', color: 'blue' },
  { value: 'offline', label: 'Hors ligne', color: 'red' },
  { value: 'retired', label: 'Retiré', color: 'gray' }
];

export default labAnalyzerService;
