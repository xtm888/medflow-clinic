import api from './apiConfig';

const clinicalDecisionSupportService = {
  // ============================================
  // RNFL ANALYSIS
  // ============================================

  // Analyze RNFL data
  analyzeRNFL: async (octData, patientAge, eye) => {
    const response = await api.post('/clinical-decision-support/rnfl/analyze', {
      octData,
      patientAge,
      eye
    });
    return response.data;
  },

  // Detect RNFL progression
  detectRNFLProgression: async (currentOCT, previousOCTs, patientAge, timePeriodYears) => {
    const response = await api.post('/clinical-decision-support/rnfl/progression', {
      currentOCT,
      previousOCTs,
      patientAge,
      timePeriodYears
    });
    return response.data;
  },

  // Generate RNFL alert
  generateRNFLAlert: async (analysis, progressionData, patientId) => {
    const response = await api.post('/clinical-decision-support/rnfl/alert', {
      analysis,
      progressionData,
      patientId
    });
    return response.data;
  },

  // ============================================
  // GPA (GLAUCOMA PROGRESSION ANALYSIS)
  // ============================================

  // Perform GPA analysis
  performGPAAnalysis: async (visualFieldData, patientAge, eye, diagnosisDate) => {
    const response = await api.post('/clinical-decision-support/gpa/analyze', {
      visualFieldData,
      patientAge,
      eye,
      diagnosisDate
    });
    return response.data;
  },

  // Generate GPA alert
  generateGPAAlert: async (gpaAnalysis, patientId, currentTreatment) => {
    const response = await api.post('/clinical-decision-support/gpa/alert', {
      gpaAnalysis,
      patientId,
      currentTreatment
    });
    return response.data;
  },

  // ============================================
  // DR GRADING (DIABETIC RETINOPATHY)
  // ============================================

  // Calculate DR grade
  calculateDRGrade: async (fundusFindings, eye) => {
    const response = await api.post('/clinical-decision-support/dr/grade', {
      fundusFindings,
      eye
    });
    return response.data;
  },

  // Assess DME
  assessDME: async (octFindings, eye) => {
    const response = await api.post('/clinical-decision-support/dr/dme', {
      octFindings,
      eye
    });
    return response.data;
  },

  // Generate DR alert
  generateDRAlert: async (drGrading, dmeAssessment, patientId, previousGrading) => {
    const response = await api.post('/clinical-decision-support/dr/alert', {
      drGrading,
      dmeAssessment,
      patientId,
      previousGrading
    });
    return response.data;
  },

  // Get DR follow-up recommendations
  getDRFollowUp: async (drGrading, dmeAssessment) => {
    const response = await api.post('/clinical-decision-support/dr/followup', {
      drGrading,
      dmeAssessment
    });
    return response.data;
  },

  // ============================================
  // REFERRAL TRIGGERS
  // ============================================

  // Process referral triggers
  processReferralTriggers: async (patientId, clinicalData, examiningPhysician) => {
    const response = await api.post('/clinical-decision-support/referrals/process', {
      patientId,
      clinicalData,
      examiningPhysician
    });
    return response.data;
  },

  // Get pending referrals for patient
  getPendingReferrals: async (patientId) => {
    const response = await api.get(`/clinical-decision-support/referrals/patient/${patientId}`);
    return response.data;
  }
};

export default clinicalDecisionSupportService;
