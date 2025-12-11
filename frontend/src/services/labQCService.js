import api from './apiConfig';
import offlineWrapper from './offlineWrapper';

const labQCService = {
  // ============================================
  // WESTGARD QC
  // ============================================

  /**
   * Evaluate Westgard rules
   * ONLINE-ONLY - Real-time QC rule evaluation for patient safety
   */
  evaluateWestgardRules: async (qcValues, mean, sd, previousValues = []) => {
    if (!navigator.onLine) {
      throw new Error('Le contrôle qualité nécessite une connexion internet pour garantir la sécurité des patients.');
    }
    const response = await api.post('/lab-qc/qc/westgard/evaluate', {
      qcValues,
      mean,
      sd,
      previousValues
    });
    return response.data;
  },

  /**
   * Process QC run
   * ONLINE-ONLY - QC processing affects instrument validation
   */
  processQCRun: async (testCode, controlLevel, measuredValue, lotNumber, instrumentId) => {
    if (!navigator.onLine) {
      throw new Error('Le traitement QC nécessite une connexion internet pour la validation des instruments.');
    }
    const response = await api.post('/lab-qc/qc/run', {
      testCode,
      controlLevel,
      measuredValue,
      lotNumber,
      instrumentId
    });
    return response.data;
  },

  /**
   * Get QC chart data
   * WORKS OFFLINE - cached for 30 minutes
   */
  getQCChartData: async (testCode, controlLevel, days = 30) => {
    const cacheKey = `qc_chart_${testCode}_${controlLevel}_${days}`;
    return offlineWrapper.get(
      () => api.get(`/lab-qc/qc/chart/${testCode}/${controlLevel}`, { params: { days } }),
      'labQCCache',
      cacheKey,
      { transform: r => r.data, cacheExpiry: 1800 }
    );
  },

  /**
   * Get QC statistics
   * WORKS OFFLINE - cached for 1 hour
   */
  getQCStatistics: async (testCode, startDate, endDate) => {
    const cacheKey = `qc_stats_${testCode}_${startDate}_${endDate}`;
    return offlineWrapper.get(
      () => api.get(`/lab-qc/qc/stats/${testCode}`, { params: { startDate, endDate } }),
      'labQCCache',
      cacheKey,
      { transform: r => r.data, cacheExpiry: 3600 }
    );
  },

  /**
   * Get QC failures
   * WORKS OFFLINE - cached for 10 minutes
   */
  getQCFailures: async (params = {}) => {
    const cacheKey = `qc_failures_${JSON.stringify(params)}`;
    return offlineWrapper.get(
      () => api.get('/lab-qc/qc/failures', { params }),
      'labQCCache',
      cacheKey,
      { transform: r => r.data, cacheExpiry: 600 }
    );
  },

  // ============================================
  // AUTO-VERIFICATION
  // ============================================

  /**
   * Process auto-verification
   * ONLINE-ONLY - Auto-verify affects result release, patient safety critical
   */
  processAutoVerification: async (labResult, patientContext = {}) => {
    if (!navigator.onLine) {
      throw new Error('La vérification automatique nécessite une connexion internet pour la sécurité des patients.');
    }
    const response = await api.post('/lab-qc/auto-verify/process', {
      labResult,
      patientContext
    });
    return response.data;
  },

  /**
   * Check critical value
   * ONLINE-ONLY - Critical value detection MUST be real-time
   */
  checkCriticalValue: async (testCode, value, unit) => {
    if (!navigator.onLine) {
      throw new Error('La détection des valeurs critiques nécessite une connexion internet.');
    }
    const response = await api.post('/lab-qc/auto-verify/critical-check', {
      testCode,
      value,
      unit
    });
    return response.data;
  },

  /**
   * Calculate delta check
   * ONLINE-ONLY - Delta check affects patient safety
   */
  calculateDeltaCheck: async (testCode, currentValue, previousValue, previousDate) => {
    if (!navigator.onLine) {
      throw new Error('Le calcul delta nécessite une connexion internet pour la sécurité des patients.');
    }
    const response = await api.post('/lab-qc/auto-verify/delta-check', {
      testCode,
      currentValue,
      previousValue,
      previousDate
    });
    return response.data;
  },

  /**
   * Get auto-verification rules
   * WORKS OFFLINE - cached for 1 hour (rules don't change often)
   */
  getAutoVerificationRules: async () => {
    return offlineWrapper.get(
      () => api.get('/lab-qc/auto-verify/rules'),
      'labQCCache',
      'auto_verify_rules',
      { transform: r => r.data, cacheExpiry: 3600 }
    );
  },

  /**
   * Get auto-verification statistics
   * WORKS OFFLINE - cached for 1 hour
   */
  getAutoVerificationStats: async (startDate, endDate) => {
    const cacheKey = `auto_verify_stats_${startDate}_${endDate}`;
    return offlineWrapper.get(
      () => api.get('/lab-qc/auto-verify/stats', { params: { startDate, endDate } }),
      'labQCCache',
      cacheKey,
      { transform: r => r.data, cacheExpiry: 3600 }
    );
  },

  /**
   * Batch auto-verify results
   * ONLINE-ONLY - Batch verification affects multiple patient results
   */
  batchAutoVerify: async (labResults, patientContexts) => {
    if (!navigator.onLine) {
      throw new Error('La vérification par lot nécessite une connexion internet pour la sécurité des patients.');
    }
    const response = await api.post('/lab-qc/auto-verify/batch', {
      labResults,
      patientContexts
    });
    return response.data;
  },

  // ============================================
  // OFFLINE HELPERS
  // ============================================

  /**
   * Pre-cache QC data for lab shift
   * WORKS OFFLINE - populates cache for reference
   */
  preCacheForShift: async () => {
    if (!navigator.onLine) return { cached: 0 };
    try {
      const [rules, failures] = await Promise.all([
        labQCService.getAutoVerificationRules(),
        labQCService.getQCFailures({ limit: 100 })
      ]);
      return {
        cached: 2,
        rules: rules ? 1 : 0,
        failures: failures?.length || 0
      };
    } catch (error) {
      console.error('Lab QC pre-cache failed:', error);
      return { cached: 0, error: error.message };
    }
  }
};

export default labQCService;
