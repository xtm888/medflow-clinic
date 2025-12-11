import api from './apiConfig';

const BASE_URL = '/external-facilities';

/**
 * External Facility Service
 * Manages external providers (pharmacies, labs, surgical centers, etc.)
 */
const externalFacilityService = {
  // Get all external facilities with filters
  getAll: async (params = {}) => {
    const response = await api.get(BASE_URL, { params });
    return response.data;
  },

  // Get single external facility by ID
  getById: async (id) => {
    const response = await api.get(`${BASE_URL}/${id}`);
    return response.data;
  },

  // Create new external facility
  create: async (data) => {
    const response = await api.post(BASE_URL, data);
    return response.data;
  },

  // Update external facility
  update: async (id, data) => {
    const response = await api.put(`${BASE_URL}/${id}`, data);
    return response.data;
  },

  // Delete (deactivate) external facility
  delete: async (id) => {
    const response = await api.delete(`${BASE_URL}/${id}`);
    return response.data;
  },

  // Get facilities by type
  getByType: async (type, params = {}) => {
    const response = await api.get(`${BASE_URL}/by-type/${type}`, { params });
    return response.data;
  },

  // Get preferred facilities for a service code
  getPreferredForService: async (serviceCode) => {
    const response = await api.get(`${BASE_URL}/preferred/${serviceCode}`);
    return response.data;
  },

  // Get facility stats
  getStats: async (id) => {
    const response = await api.get(`${BASE_URL}/${id}/stats`);
    return response.data;
  },

  // Check if facility is open
  checkIfOpen: async (id) => {
    const response = await api.get(`${BASE_URL}/${id}/is-open`);
    return response.data;
  },

  // Record a referral
  recordReferral: async (id, completed = false) => {
    const response = await api.post(`${BASE_URL}/${id}/record-referral`, { completed });
    return response.data;
  },

  // Get summary of all facilities
  getSummary: async () => {
    const response = await api.get(`${BASE_URL}/summary`);
    return response.data;
  },

  // Facility type options for dropdowns
  facilityTypes: [
    { value: 'pharmacy', label: 'Pharmacie' },
    { value: 'laboratory', label: 'Laboratoire' },
    { value: 'imaging-center', label: 'Centre d\'imagerie' },
    { value: 'surgical-facility', label: 'Centre chirurgical' },
    { value: 'optical-shop', label: 'Opticien' },
    { value: 'specialist-clinic', label: 'Clinique spécialisée' },
    { value: 'hospital', label: 'Hôpital' },
    { value: 'therapy-center', label: 'Centre de rééducation' },
    { value: 'other', label: 'Autre' }
  ],

  // Get type label
  getTypeLabel: (type) => {
    const found = externalFacilityService.facilityTypes.find(t => t.value === type);
    return found ? found.label : type;
  }
};

export default externalFacilityService;
