import api from './apiConfig';

const drugSafetyService = {
  // ============================================
  // DOSE CALCULATION
  // ============================================

  // Calculate pediatric dose
  calculatePediatricDose: async (drugName, weightKg, ageYears, standardDoseMgPerKg, frequency) => {
    const response = await api.post('/drug-safety/dose/pediatric', {
      drugName,
      weightKg,
      ageYears,
      standardDoseMgPerKg,
      frequency
    });
    return response.data;
  },

  // Validate prescribed dose
  validateDose: async (drugName, prescribedDose, patientWeight, patientAge, frequency, indication) => {
    const response = await api.post('/drug-safety/dose/validate', {
      drugName,
      prescribedDose,
      patientWeight,
      patientAge,
      frequency,
      indication
    });
    return response.data;
  },

  // Calculate renal adjustment
  calculateRenalAdjustment: async (drugName, standardDose, creatinineClearance) => {
    const response = await api.post('/drug-safety/dose/renal-adjustment', {
      drugName,
      standardDose,
      creatinineClearance
    });
    return response.data;
  },

  // Calculate eGFR
  calculateEGFR: async (creatinine, age, isFemale, isBlack) => {
    const response = await api.post('/drug-safety/egfr/calculate', {
      creatinine,
      age,
      isFemale,
      isBlack
    });
    return response.data;
  },

  // ============================================
  // CUMULATIVE DOSE TRACKING
  // ============================================

  // Check cumulative dose limit
  checkCumulativeLimit: async (patientId, drugName, proposedDose, unit) => {
    const response = await api.post('/drug-safety/cumulative/check', {
      patientId,
      drugName,
      proposedDose,
      unit
    });
    return response.data;
  },

  // Get patient cumulative dose history
  getCumulativeDose: async (patientId, drugName) => {
    const response = await api.get(`/drug-safety/cumulative/patient/${patientId}/${drugName}`);
    return response.data;
  },

  // Record dose administration
  recordDose: async (patientId, drugName, dose, unit, notes) => {
    const response = await api.post('/drug-safety/cumulative/record', {
      patientId,
      drugName,
      dose,
      unit,
      notes
    });
    return response.data;
  },

  // Get patients approaching cumulative limits
  getPatientsAtRisk: async (thresholdPercent = 75) => {
    const response = await api.get('/drug-safety/cumulative/at-risk', {
      params: { thresholdPercent }
    });
    return response.data;
  },

  // ============================================
  // THERAPEUTIC CLASS
  // ============================================

  // Check for therapeutic duplications
  checkDuplications: async (patientId, newMedications) => {
    const response = await api.post('/drug-safety/therapeutic/check-duplications', {
      patientId,
      newMedications
    });
    return response.data;
  },

  // Get therapeutic class for medication
  getTherapeuticClass: async (medication) => {
    const response = await api.get(`/drug-safety/therapeutic/class/${encodeURIComponent(medication)}`);
    return response.data;
  },

  // Full prescription safety check
  performSafetyCheck: async (patientId, medications) => {
    const response = await api.post('/drug-safety/safety-check', {
      patientId,
      medications
    });
    return response.data;
  }
};

export default drugSafetyService;
