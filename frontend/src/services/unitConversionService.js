import api from './apiConfig';

const BASE_URL = '/unit-conversions';

/**
 * Unit Conversion Service
 * Gestion des conversions d'unités SI/conventionnelles
 */

export const unitConversionService = {
  // Get all conversions
  getConversions: async (params = {}) => {
    const response = await api.get(BASE_URL, { params });
    return response.data;
  },

  // Get conversion for specific test
  getConversion: async (testCode) => {
    const response = await api.get(`${BASE_URL}/${testCode}`);
    return response.data;
  },

  // Convert a value
  convertValue: async (testCode, value, fromUnit, toUnit) => {
    const response = await api.post(`${BASE_URL}/convert`, {
      testCode,
      value,
      fromUnit,
      toUnit
    });
    return response.data;
  },

  // Batch convert multiple values
  batchConvert: async (conversions) => {
    const response = await api.post(`${BASE_URL}/batch-convert`, { conversions });
    return response.data;
  },

  // Get available units for a test
  getAvailableUnits: async (testCode) => {
    const response = await api.get(`${BASE_URL}/${testCode}/units`);
    return response.data;
  },

  // Get conversion factor
  getConversionFactor: async (testCode, fromUnit, toUnit) => {
    const response = await api.get(`${BASE_URL}/${testCode}/factor`, {
      params: { fromUnit, toUnit }
    });
    return response.data;
  },

  // Get categories
  getCategories: async () => {
    const response = await api.get(`${BASE_URL}/categories`);
    return response.data;
  },

  // Create conversion (admin)
  createConversion: async (data) => {
    const response = await api.post(BASE_URL, data);
    return response.data;
  },

  // Update conversion (admin)
  updateConversion: async (testCode, data) => {
    const response = await api.put(`${BASE_URL}/${testCode}`, data);
    return response.data;
  },

  // Delete conversion (admin)
  deleteConversion: async (testCode) => {
    const response = await api.delete(`${BASE_URL}/${testCode}`);
    return response.data;
  },

  // Seed common conversions (admin)
  seedConversions: async () => {
    const response = await api.post(`${BASE_URL}/seed`);
    return response.data;
  }
};

// Common unit abbreviations
export const COMMON_UNITS = {
  // Glucose
  GLU: { si: 'mmol/L', conventional: 'mg/dL' },
  // Creatinine
  CREA: { si: 'µmol/L', conventional: 'mg/dL' },
  // Urea/BUN
  UREA: { si: 'mmol/L', conventional: 'mg/dL' },
  // Cholesterol
  CHOL: { si: 'mmol/L', conventional: 'mg/dL' },
  // Triglycerides
  TRIG: { si: 'mmol/L', conventional: 'mg/dL' },
  // Hemoglobin
  HB: { si: 'g/L', conventional: 'g/dL' },
  // Bilirubin
  BILI: { si: 'µmol/L', conventional: 'mg/dL' },
  // Calcium
  CA: { si: 'mmol/L', conventional: 'mg/dL' },
  // Iron
  FE: { si: 'µmol/L', conventional: 'µg/dL' },
  // Uric Acid
  URIC: { si: 'µmol/L', conventional: 'mg/dL' }
};

// Unit type labels
export const UNIT_TYPES = {
  SI: 'Unités SI',
  conventional: 'Unités Conventionnelles'
};

export default unitConversionService;
