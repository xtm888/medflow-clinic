/**
 * Clinical Decision Support API Routes
 * Provides endpoints for RNFL analysis, GPA, DR grading, and referral triggers
 */
const express = require('express');
const router = express.Router();
const { protect, authorize, requirePermission } = require('../middleware/auth');
const { logAction } = require('../middleware/auditLogger');
const { asyncHandler } = require('../middleware/errorHandler');

// Import clinical decision support services
const rnflAnalysisService = require('../services/rnflAnalysisService');
const gpaService = require('../services/gpaService');
const drGradingService = require('../services/drGradingService');
const referralTriggerService = require('../services/referralTriggerService');

// Protect all routes
router.use(protect);

// ============================================
// RNFL ANALYSIS ROUTES
// ============================================

// Analyze RNFL data
router.post('/rnfl/analyze',
  requirePermission('view_ophthalmology', 'manage_ophthalmology'),
  logAction('RNFL_ANALYSIS'),
  asyncHandler(async (req, res) => {
    const { octData, patientAge, eye } = req.body;

    if (!octData || !patientAge || !eye) {
      return res.status(400).json({
        success: false,
        error: 'OCT data, patient age, and eye are required'
      });
    }

    const analysis = rnflAnalysisService.analyzeRNFL(octData, patientAge, eye);

    res.json({ success: true, data: analysis });
  })
);

// Detect RNFL progression
router.post('/rnfl/progression',
  requirePermission('view_ophthalmology', 'manage_ophthalmology'),
  logAction('RNFL_PROGRESSION'),
  asyncHandler(async (req, res) => {
    const { currentOCT, previousOCTs, patientAge, timePeriodYears } = req.body;

    if (!currentOCT || !previousOCTs || previousOCTs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Current OCT and at least one previous OCT are required'
      });
    }

    const progression = rnflAnalysisService.detectRNFLProgression(
      currentOCT,
      previousOCTs,
      patientAge,
      timePeriodYears
    );

    res.json({ success: true, data: progression });
  })
);

// Generate RNFL alert
router.post('/rnfl/alert',
  requirePermission('view_ophthalmology', 'manage_ophthalmology'),
  logAction('RNFL_ALERT_GENERATE'),
  asyncHandler(async (req, res) => {
    const { analysis, progressionData, patientId } = req.body;

    const alert = rnflAnalysisService.generateRNFLAlert(analysis, progressionData, patientId);

    res.json({ success: true, data: alert });
  })
);

// ============================================
// GPA (GLAUCOMA PROGRESSION ANALYSIS) ROUTES
// ============================================

// Perform GPA analysis
router.post('/gpa/analyze',
  requirePermission('view_ophthalmology', 'manage_ophthalmology'),
  logAction('GPA_ANALYSIS'),
  asyncHandler(async (req, res) => {
    const { visualFieldData, patientAge, eye, diagnosisDate } = req.body;

    if (!visualFieldData || visualFieldData.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'At least 3 visual field exams are required for GPA analysis'
      });
    }

    const analysis = gpaService.performGPAAnalysis(
      visualFieldData,
      patientAge,
      eye,
      diagnosisDate
    );

    res.json({ success: true, data: analysis });
  })
);

// Generate GPA alert
router.post('/gpa/alert',
  requirePermission('view_ophthalmology', 'manage_ophthalmology'),
  logAction('GPA_ALERT_GENERATE'),
  asyncHandler(async (req, res) => {
    const { gpaAnalysis, patientId, currentTreatment } = req.body;

    const alert = gpaService.generateGPAAlert(gpaAnalysis, patientId, currentTreatment);

    res.json({ success: true, data: alert });
  })
);

// ============================================
// DR GRADING (DIABETIC RETINOPATHY) ROUTES
// ============================================

// Calculate DR grade
router.post('/dr/grade',
  requirePermission('view_ophthalmology', 'manage_ophthalmology'),
  logAction('DR_GRADING'),
  asyncHandler(async (req, res) => {
    const { fundusFindings, eye } = req.body;

    if (!fundusFindings || !eye) {
      return res.status(400).json({
        success: false,
        error: 'Fundus findings and eye are required'
      });
    }

    const grading = drGradingService.calculateDRGrade(fundusFindings, eye);

    res.json({ success: true, data: grading });
  })
);

// Assess DME
router.post('/dr/dme',
  requirePermission('view_ophthalmology', 'manage_ophthalmology'),
  logAction('DME_ASSESSMENT'),
  asyncHandler(async (req, res) => {
    const { octFindings, eye } = req.body;

    if (!octFindings || !eye) {
      return res.status(400).json({
        success: false,
        error: 'OCT findings and eye are required'
      });
    }

    const assessment = drGradingService.assessDME(octFindings, eye);

    res.json({ success: true, data: assessment });
  })
);

// Generate DR alert
router.post('/dr/alert',
  requirePermission('view_ophthalmology', 'manage_ophthalmology'),
  logAction('DR_ALERT_GENERATE'),
  asyncHandler(async (req, res) => {
    const { drGrading, dmeAssessment, patientId, previousGrading } = req.body;

    const alert = drGradingService.generateDRAlert(
      drGrading,
      dmeAssessment,
      patientId,
      previousGrading
    );

    res.json({ success: true, data: alert });
  })
);

// Get DR follow-up recommendations
router.post('/dr/followup',
  requirePermission('view_ophthalmology', 'manage_ophthalmology'),
  logAction('DR_FOLLOWUP'),
  asyncHandler(async (req, res) => {
    const { drGrading, dmeAssessment } = req.body;

    const recommendations = drGradingService.getFollowUpRecommendations(
      drGrading,
      dmeAssessment
    );

    res.json({ success: true, data: recommendations });
  })
);

// ============================================
// REFERRAL TRIGGER ROUTES
// ============================================

// Process referral triggers
router.post('/referrals/process',
  requirePermission('view_patients', 'manage_patients'),
  logAction('REFERRAL_TRIGGER_PROCESS'),
  asyncHandler(async (req, res) => {
    const { patientId, clinicalData, examiningPhysician } = req.body;

    if (!patientId || !clinicalData) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID and clinical data are required'
      });
    }

    const referrals = await referralTriggerService.processReferralTriggers(
      patientId,
      clinicalData,
      examiningPhysician || req.user._id
    );

    res.json({ success: true, data: referrals });
  })
);

// Get pending referrals for patient
router.get('/referrals/patient/:patientId',
  requirePermission('view_patients'),
  logAction('REFERRAL_VIEW'),
  asyncHandler(async (req, res) => {
    const referrals = await referralTriggerService.getPendingReferrals(req.params.patientId);

    res.json({ success: true, data: referrals });
  })
);

module.exports = router;
