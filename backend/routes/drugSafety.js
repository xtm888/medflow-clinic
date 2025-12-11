/**
 * Drug Safety API Routes
 * Provides endpoints for dose calculation, cumulative dose tracking, and therapeutic class checks
 */
const express = require('express');
const router = express.Router();
const { protect, authorize, requirePermission } = require('../middleware/auth');
const { logAction } = require('../middleware/auditLogger');
const { asyncHandler } = require('../middleware/errorHandler');
const Patient = require('../models/Patient');

// Import drug safety services
const doseCalculationService = require('../services/doseCalculationService');
const cumulativeDoseService = require('../services/cumulativeDoseService');
const therapeuticClassService = require('../services/therapeuticClassService');

// Protect all routes
router.use(protect);

// ============================================
// DOSE CALCULATION ROUTES
// ============================================

// Calculate pediatric dose
router.post('/dose/pediatric',
  requirePermission('create_prescriptions', 'view_pharmacy'),
  logAction('DOSE_CALCULATION'),
  asyncHandler(async (req, res) => {
    const { drugName, weightKg, ageYears, standardDoseMgPerKg, frequency } = req.body;

    if (!drugName || !weightKg) {
      return res.status(400).json({
        success: false,
        error: 'Drug name and patient weight are required'
      });
    }

    const calculation = doseCalculationService.calculatePediatricDose(
      drugName,
      weightKg,
      ageYears,
      standardDoseMgPerKg,
      frequency
    );

    res.json({ success: true, data: calculation });
  })
);

// Validate prescribed dose
router.post('/dose/validate',
  requirePermission('create_prescriptions', 'view_pharmacy'),
  logAction('DOSE_VALIDATION'),
  asyncHandler(async (req, res) => {
    const { drugName, prescribedDose, patientWeight, patientAge, frequency, indication } = req.body;

    if (!drugName || !prescribedDose) {
      return res.status(400).json({
        success: false,
        error: 'Drug name and prescribed dose are required'
      });
    }

    const validation = doseCalculationService.validatePrescribedDose(
      drugName,
      prescribedDose,
      patientWeight,
      patientAge,
      frequency,
      indication
    );

    res.json({ success: true, data: validation });
  })
);

// Calculate renal adjustment
router.post('/dose/renal-adjustment',
  requirePermission('create_prescriptions', 'view_pharmacy'),
  logAction('RENAL_DOSE_ADJUSTMENT'),
  asyncHandler(async (req, res) => {
    const { drugName, standardDose, creatinineClearance } = req.body;

    if (!drugName || !standardDose || !creatinineClearance) {
      return res.status(400).json({
        success: false,
        error: 'Drug name, standard dose, and creatinine clearance are required'
      });
    }

    const adjustment = doseCalculationService.calculateRenalAdjustment(
      drugName,
      standardDose,
      creatinineClearance
    );

    res.json({ success: true, data: adjustment });
  })
);

// Calculate eGFR
router.post('/egfr/calculate',
  requirePermission('view_patients', 'view_laboratory'),
  logAction('EGFR_CALCULATION'),
  asyncHandler(async (req, res) => {
    const { creatinine, age, isFemale, isBlack } = req.body;

    if (!creatinine || !age) {
      return res.status(400).json({
        success: false,
        error: 'Creatinine and age are required'
      });
    }

    const egfr = doseCalculationService.calculateEGFR(creatinine, age, isFemale, isBlack);

    res.json({
      success: true,
      data: {
        egfr,
        unit: 'mL/min/1.73m²',
        interpretation: egfr >= 90 ? 'Normal' :
                       egfr >= 60 ? 'Mildly decreased' :
                       egfr >= 30 ? 'Moderately decreased' :
                       egfr >= 15 ? 'Severely decreased' : 'Kidney failure'
      }
    });
  })
);

// ============================================
// CUMULATIVE DOSE TRACKING ROUTES
// ============================================

// Check cumulative dose limit
router.post('/cumulative/check',
  requirePermission('create_prescriptions', 'view_pharmacy'),
  logAction('CUMULATIVE_DOSE_CHECK'),
  asyncHandler(async (req, res) => {
    const { patientId, drugName, proposedDose, unit } = req.body;

    if (!patientId || !drugName || !proposedDose) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID, drug name, and proposed dose are required'
      });
    }

    const check = await cumulativeDoseService.checkCumulativeLimit(
      patientId,
      drugName,
      proposedDose,
      unit
    );

    res.json({ success: true, data: check });
  })
);

// Get patient cumulative dose history
router.get('/cumulative/patient/:patientId/:drugName',
  requirePermission('view_patients', 'view_pharmacy'),
  logAction('CUMULATIVE_DOSE_VIEW'),
  asyncHandler(async (req, res) => {
    const { patientId, drugName } = req.params;

    const cumulativeDose = await cumulativeDoseService.getPatientCumulativeDose(patientId, drugName);

    res.json({ success: true, data: cumulativeDose });
  })
);

// Record dose administration
router.post('/cumulative/record',
  requirePermission('manage_pharmacy', 'create_prescriptions'),
  logAction('CUMULATIVE_DOSE_RECORD'),
  asyncHandler(async (req, res) => {
    const { patientId, drugName, dose, unit, administeredBy, notes } = req.body;

    if (!patientId || !drugName || !dose) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID, drug name, and dose are required'
      });
    }

    const result = await cumulativeDoseService.recordDoseAdministration(
      patientId,
      drugName,
      dose,
      unit,
      administeredBy || req.user._id,
      notes
    );

    res.json({ success: true, data: result });
  })
);

// Get patients approaching cumulative limits
router.get('/cumulative/at-risk',
  requirePermission('view_pharmacy', 'manage_pharmacy'),
  logAction('CUMULATIVE_AT_RISK_VIEW'),
  asyncHandler(async (req, res) => {
    const { thresholdPercent = 75 } = req.query;

    const atRiskPatients = await cumulativeDoseService.getPatientsApproachingLimits(
      parseFloat(thresholdPercent)
    );

    res.json({ success: true, data: atRiskPatients });
  })
);

// ============================================
// THERAPEUTIC CLASS ROUTES
// ============================================

// Check for therapeutic duplications
router.post('/therapeutic/check-duplications',
  requirePermission('create_prescriptions', 'view_pharmacy'),
  logAction('THERAPEUTIC_DUPLICATION_CHECK'),
  asyncHandler(async (req, res) => {
    const { patientId, newMedications } = req.body;

    if (!patientId || !newMedications) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID and new medications are required'
      });
    }

    const duplications = await therapeuticClassService.checkPatientDuplications(
      patientId,
      newMedications
    );

    res.json({ success: true, data: duplications });
  })
);

// Get therapeutic class for medication
router.get('/therapeutic/class/:medication',
  requirePermission('view_pharmacy'),
  logAction('THERAPEUTIC_CLASS_VIEW'),
  asyncHandler(async (req, res) => {
    const therapeuticClass = therapeuticClassService.getTherapeuticClass(req.params.medication);

    res.json({
      success: true,
      data: {
        medication: req.params.medication,
        therapeuticClass: therapeuticClass || 'Unknown'
      }
    });
  })
);

// Full prescription safety check
router.post('/safety-check',
  requirePermission('create_prescriptions'),
  logAction('FULL_SAFETY_CHECK'),
  asyncHandler(async (req, res) => {
    const { patientId, medications } = req.body;

    if (!patientId || !medications || medications.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID and medications are required'
      });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // Run all safety checks
    const results = {
      doseValidations: [],
      cumulativeChecks: [],
      therapeuticDuplications: [],
      overallSafe: true,
      warnings: [],
      errors: []
    };

    // Check each medication
    for (const med of medications) {
      // Dose validation
      if (med.dose && patient.weight) {
        const doseCheck = doseCalculationService.validatePrescribedDose(
          med.name,
          med.dose,
          patient.weight,
          patient.age,
          med.frequency
        );
        results.doseValidations.push({ medication: med.name, ...doseCheck });

        if (!doseCheck.isValid) {
          results.overallSafe = false;
          results.errors.push(`${med.name}: ${doseCheck.message}`);
        } else if (doseCheck.warnings?.length > 0) {
          results.warnings.push(...doseCheck.warnings.map(w => `${med.name}: ${w}`));
        }
      }

      // Cumulative dose check for tracked medications
      const cumCheck = await cumulativeDoseService.checkCumulativeLimit(
        patientId,
        med.name,
        parseFloat(med.dose) || 0
      );
      if (cumCheck.tracked) {
        results.cumulativeChecks.push({ medication: med.name, ...cumCheck });

        if (!cumCheck.safe) {
          results.overallSafe = false;
          results.errors.push(`${med.name}: Cumulative dose limit exceeded`);
        } else if (cumCheck.percentOfLimit > 75) {
          results.warnings.push(`${med.name}: Approaching cumulative limit (${cumCheck.percentOfLimit}%)`);
        }
      }
    }

    // Therapeutic duplication check
    const duplications = await therapeuticClassService.checkPatientDuplications(patientId, medications);
    results.therapeuticDuplications = duplications;

    if (duplications.length > 0) {
      const criticalDups = duplications.filter(d => d.severity === 'high');
      if (criticalDups.length > 0) {
        results.overallSafe = false;
        results.errors.push(...criticalDups.map(d => d.message));
      } else {
        results.warnings.push(...duplications.map(d => d.message));
      }
    }

    res.json({ success: true, data: results });
  })
);

module.exports = router;
