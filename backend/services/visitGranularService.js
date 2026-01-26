/**
 * Visit Granular Update Service
 *
 * Implements CareVision's reliable granular update pattern from DonConsultation.cs.
 * Each consultation section is saved independently, preventing cascading failures
 * that plague monolithic save operations.
 *
 * CareVision Pattern Mapping:
 * - ModifierConsultationRefrac() -> updateVisitRefraction()
 * - ModifierConsultationPathologie() -> updateVisitDiagnosis()
 * - ModifierConsultationTraite() -> updateVisitTreatment()
 * - ModifierConsultationRefra() (TOD/TOG) -> updateVisitIOP()
 *
 * Key Principle: Use findByIdAndUpdate() with runValidators: false
 * to BYPASS the heavy pre-save hooks that cause cascading failures.
 *
 * @see backend/docs/GRANULAR_UPDATE_PATTERN.md
 * @see backend/docs/BUG_CATALOG.md
 */

const mongoose = require('mongoose');
const Visit = require('../models/Visit');
const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('VisitGranular');

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate MongoDB ObjectId
 * @param {string} id - ID to validate
 * @param {string} fieldName - Field name for error message
 */
function validateObjectId(id, fieldName = 'ID') {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error(`${fieldName} invalide`);
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Validate IOP value is within range
 * @param {number} value - IOP value in mmHg
 * @param {string} eye - Eye identifier (OD/OS)
 */
function validateIOPValue(value, eye) {
  if (value !== undefined && value !== null) {
    if (typeof value !== 'number' || value < 0 || value > 60) {
      const error = new Error(`La valeur de pression intraoculaire ${eye} doit être entre 0 et 60 mmHg`);
      error.statusCode = 400;
      throw error;
    }
  }
}

/**
 * Validate visual acuity value (Monoyer scale)
 * @param {string} value - Visual acuity value
 */
function validateVisualAcuityValue(value) {
  if (!value) return true;

  // Valid Monoyer scale values
  const validMonoyer = [
    '10/10', '9/10', '8/10', '7/10', '6/10', '5/10', '4/10', '3/10', '2/10', '1/10',
    '1/20', '1/50', 'CLD', 'VBLM', 'PL+', 'PL-'
  ];

  // Valid Parinaud scale values
  const validParinaud = ['P1.5', 'P2', 'P3', 'P4', 'P5', 'P6', 'P8', 'P10', 'P14', 'P20'];

  const upperValue = value.toUpperCase();
  return validMonoyer.includes(upperValue) ||
         validParinaud.some(p => upperValue === p.toUpperCase()) ||
         /^\d{1,2}\/\d{1,2}$/.test(value); // Allow fraction format
}

/**
 * Validate refraction sphere value (diopters)
 * @param {number} value - Sphere value in diopters
 * @returns {boolean} True if valid
 */
function validateSphereValue(value) {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'number') return false;
  // Clinical range: -25.00 to +25.00 diopters
  return value >= -25 && value <= 25;
}

/**
 * Validate refraction cylinder value (diopters)
 * @param {number} value - Cylinder value in diopters
 * @returns {boolean} True if valid
 */
function validateCylinderValue(value) {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'number') return false;
  // Clinical range: -10.00 to +10.00 diopters
  return value >= -10 && value <= 10;
}

/**
 * Validate refraction axis value (degrees)
 * @param {number} value - Axis value in degrees
 * @returns {boolean} True if valid
 */
function validateAxisValue(value) {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'number') return false;
  // Valid range: 0 to 180 degrees
  return value >= 0 && value <= 180;
}

/**
 * Validate addition value for presbyopia (diopters)
 * @param {number} value - Addition value in diopters
 * @returns {boolean} True if valid
 */
function validateAdditionValue(value) {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'number') return false;
  // Clinical range: +0.25 to +4.00 diopters
  return value >= 0.25 && value <= 4;
}

/**
 * Validate a complete refraction eye object
 * @param {Object} eyeData - Eye refraction data (sphere, cylinder, axis, add)
 * @param {string} eye - Eye identifier (OD/OS) for error messages
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
function validateRefractionEye(eyeData, eye) {
  const errors = [];

  if (!eyeData || typeof eyeData !== 'object') {
    return { valid: true, errors: [] }; // Empty data is valid (optional)
  }

  if (!validateSphereValue(eyeData.sphere)) {
    errors.push(`${eye}: La sphère doit être entre -25.00 et +25.00 dioptries`);
  }

  if (!validateCylinderValue(eyeData.cylinder)) {
    errors.push(`${eye}: Le cylindre doit être entre -10.00 et +10.00 dioptries`);
  }

  if (!validateAxisValue(eyeData.axis)) {
    errors.push(`${eye}: L'axe doit être entre 0 et 180 degrés`);
  }

  if (!validateAdditionValue(eyeData.add || eyeData.addition)) {
    errors.push(`${eye}: L'addition doit être entre +0.25 et +4.00 dioptries`);
  }

  return { valid: errors.length === 0, errors };
}

// ============================================
// CORE GRANULAR UPDATE METHODS
// ============================================

/**
 * Update refraction data ONLY
 * Mirrors: CareVision's ModifierConsultationRefrac()
 *
 * Updates REFRACTION and LUNETTES fields independently without triggering
 * other pre-save hooks (FeeSchedule lookup, ID generation, etc.)
 *
 * Supports three modes:
 * 1. Link to existing OphthalmologyExam: { ophthalmologyExamId: ObjectId }
 * 2. Update linked OphthalmologyExam's refraction: { refraction: {...} }
 * 3. Update both Visit's ophthalmologyExam link AND the exam's refraction data
 *
 * CareVision Field Mapping:
 * - REFRACTION → OphthalmologyExam.refraction (objective/subjective/finalPrescription)
 * - LUNETTES → OphthalmologyExam.refraction.finalPrescription (glasses prescription)
 *
 * @param {string} visitId - Visit MongoDB ID
 * @param {Object} refractionData - Refraction examination data
 * @param {Object} refractionData.ophthalmologyExamId - Link to existing OphthalmologyExam (optional)
 * @param {Object} refractionData.refraction - Refraction data to update on linked exam (optional)
 * @param {Object} refractionData.objective - Objective refraction (autorefractor, retinoscopy)
 * @param {Object} refractionData.subjective - Subjective refraction (OD, OS, add)
 * @param {Object} refractionData.finalPrescription - Final glasses prescription
 * @param {string} userId - User performing the update
 * @returns {Promise<Object>} Updated visit and optionally updated exam
 */
async function updateVisitRefraction(visitId, refractionData, userId) {
  validateObjectId(visitId, 'Visit ID');
  validateObjectId(userId, 'User ID');

  if (!refractionData || typeof refractionData !== 'object') {
    const error = new Error('Les données de réfraction sont requises');
    error.statusCode = 400;
    throw error;
  }

  // First, get the current visit to check for linked ophthalmologyExam
  const existingVisit = await Visit.findById(visitId).lean();
  if (!existingVisit) {
    const error = new Error('Visite non trouvée');
    error.statusCode = 404;
    throw error;
  }

  let updatedExam = null;
  const updateFields = {
    updatedBy: userId,
    updatedAt: new Date()
  };

  // Mode 1: Link to an existing OphthalmologyExam
  if (refractionData.ophthalmologyExamId) {
    validateObjectId(refractionData.ophthalmologyExamId, 'OphthalmologyExam ID');
    updateFields.ophthalmologyExam = refractionData.ophthalmologyExamId;
    // Also set the deprecated field for backward compatibility
    updateFields['examinations.refraction'] = refractionData.ophthalmologyExamId;
  }

  // Mode 2 & 3: Update refraction data on linked OphthalmologyExam
  // Check if refraction data is provided (either wrapped in 'refraction' key or directly)
  const hasRefractionData = refractionData.refraction ||
    refractionData.objective ||
    refractionData.subjective ||
    refractionData.finalPrescription;

  if (hasRefractionData) {
    // Determine the exam to update
    const examId = refractionData.ophthalmologyExamId ||
      existingVisit.ophthalmologyExam ||
      existingVisit.examinations?.refraction;

    if (examId && mongoose.Types.ObjectId.isValid(examId)) {
      // Build the refraction update object
      const refractionUpdate = {};
      const refData = refractionData.refraction || refractionData;

      // Objective refraction (autorefractor, retinoscopy)
      if (refData.objective) {
        if (refData.objective.autorefractor) {
          refractionUpdate['refraction.objective.autorefractor'] = refData.objective.autorefractor;
        }
        if (refData.objective.retinoscopy) {
          refractionUpdate['refraction.objective.retinoscopy'] = refData.objective.retinoscopy;
        }
      }

      // Subjective refraction
      if (refData.subjective) {
        refractionUpdate['refraction.subjective'] = refData.subjective;
      }

      // Final prescription (LUNETTES in CareVision)
      if (refData.finalPrescription) {
        refractionUpdate['refraction.finalPrescription'] = refData.finalPrescription;
      }

      // Add audit fields to exam
      refractionUpdate.updatedBy = userId;
      refractionUpdate.updatedAt = new Date();

      // Update the OphthalmologyExam atomically
      if (Object.keys(refractionUpdate).length > 2) { // More than just audit fields
        const OphthalmologyExam = require('../models/OphthalmologyExam');
        updatedExam = await OphthalmologyExam.findByIdAndUpdate(
          examId,
          { $set: refractionUpdate },
          {
            new: true,
            runValidators: false // CRITICAL: Skip heavy pre-save hooks
          }
        );

        if (!updatedExam) {
          log.warn('Linked OphthalmologyExam not found', { examId, visitId });
        }
      }
    } else {
      // No linked exam - store refraction data reference for later linking
      // This maintains backward compatibility with systems that may set this field
      log.warn('No linked OphthalmologyExam found for refraction update', { visitId });
    }
  }

  // Update the Visit document
  const visit = await Visit.findByIdAndUpdate(
    visitId,
    { $set: updateFields },
    {
      new: true,
      runValidators: false // CRITICAL: Skip heavy pre-save hooks
    }
  );

  if (!visit) {
    const error = new Error('Visite non trouvée');
    error.statusCode = 404;
    throw error;
  }

  // Determine what was updated for logging
  const refData = refractionData.refraction || refractionData;
  log.info('Refraction updated', {
    visitId: visit.visitId || visit._id,
    userId,
    examLinked: !!refractionData.ophthalmologyExamId,
    examUpdated: !!updatedExam,
    hasObjective: !!refData.objective,
    hasSubjective: !!refData.subjective,
    hasFinalPrescription: !!refData.finalPrescription,
    hasOD: !!refData.subjective?.OD || !!refData.finalPrescription?.OD,
    hasOS: !!refData.subjective?.OS || !!refData.finalPrescription?.OS
  });

  return {
    visit,
    exam: updatedExam
  };
}

/**
 * Update diagnosis/observation ONLY
 * Mirrors: CareVision's ModifierConsultationPathologie()
 *
 * Updates Observation and DOMINANTE fields independently.
 *
 * @param {string} visitId - Visit MongoDB ID
 * @param {Array} diagnosisData - Array of diagnosis objects
 * @param {string} userId - User performing the update
 * @returns {Promise<Visit>} Updated visit document
 */
async function updateVisitDiagnosis(visitId, diagnosisData, userId) {
  validateObjectId(visitId, 'Visit ID');
  validateObjectId(userId, 'User ID');

  // Validate diagnosis structure at service layer
  if (diagnosisData !== undefined && diagnosisData !== null && !Array.isArray(diagnosisData)) {
    const error = new Error('Les diagnostics doivent être un tableau');
    error.statusCode = 400;
    throw error;
  }

  // Validate individual diagnoses
  if (diagnosisData && diagnosisData.length > 0) {
    for (const diagnosis of diagnosisData) {
      if (!diagnosis.code || !diagnosis.description) {
        const error = new Error('Chaque diagnostic doit avoir un code et une description');
        error.statusCode = 400;
        throw error;
      }
    }
  }

  const update = {
    $set: {
      diagnoses: diagnosisData || [],
      updatedBy: userId,
      updatedAt: new Date()
    }
  };

  const visit = await Visit.findByIdAndUpdate(
    visitId,
    update,
    {
      new: true,
      runValidators: false
    }
  );

  if (!visit) {
    const error = new Error('Visite non trouvée');
    error.statusCode = 404;
    throw error;
  }

  log.info('Diagnosis updated', {
    visitId: visit.visitId || visit._id,
    userId,
    diagnosisCount: diagnosisData?.length || 0
  });

  return visit;
}

/**
 * Update treatment/prescription plan ONLY
 * Mirrors: CareVision's ModifierConsultationTraite()
 *
 * Updates Ordonnance and Ordonnance2 fields independently.
 *
 * @param {string} visitId - Visit MongoDB ID
 * @param {Object} treatmentData - Treatment plan data (medications, recommendations, referrals)
 * @param {string} userId - User performing the update
 * @returns {Promise<Visit>} Updated visit document
 */
async function updateVisitTreatment(visitId, treatmentData, userId) {
  validateObjectId(visitId, 'Visit ID');
  validateObjectId(userId, 'User ID');

  if (!treatmentData || typeof treatmentData !== 'object') {
    const error = new Error('Les données de traitement sont requises');
    error.statusCode = 400;
    throw error;
  }

  const updateFields = {
    updatedBy: userId,
    updatedAt: new Date()
  };

  // Allow updating specific treatment sub-fields
  if (treatmentData.medications !== undefined) {
    updateFields['plan.medications'] = treatmentData.medications;
  }
  if (treatmentData.recommendations !== undefined) {
    updateFields['plan.lifestyle'] = treatmentData.recommendations.map(r => ({
      recommendation: r,
      category: 'general'
    }));
  }
  if (treatmentData.followUpInstructions !== undefined) {
    updateFields['plan.followUp'] = {
      required: true,
      reason: treatmentData.followUpInstructions
    };
  }
  if (treatmentData.referrals !== undefined) {
    updateFields['plan.referrals'] = treatmentData.referrals;
  }
  if (treatmentData.patientEducation !== undefined) {
    updateFields['plan.patientEducation'] = treatmentData.patientEducation;
  }
  // Full plan replacement
  if (treatmentData.plan !== undefined) {
    updateFields['plan'] = treatmentData.plan;
  }

  const visit = await Visit.findByIdAndUpdate(
    visitId,
    { $set: updateFields },
    {
      new: true,
      runValidators: false
    }
  );

  if (!visit) {
    const error = new Error('Visite non trouvée');
    error.statusCode = 404;
    throw error;
  }

  log.info('Treatment updated', {
    visitId: visit.visitId || visit._id,
    userId,
    hasMedications: !!treatmentData.medications,
    hasReferrals: !!treatmentData.referrals
  });

  return visit;
}

/**
 * Update IOP (intraocular pressure) data ONLY
 * Mirrors: CareVision's ModifierConsultationRefra() (TOD/TOG)
 *
 * TOD = Tension Oculaire Droite (right eye)
 * TOG = Tension Oculaire Gauche (left eye)
 *
 * @param {string} visitId - Visit MongoDB ID
 * @param {Object} iopData - IOP data with OD (right) and OS (left) values
 * @param {string} userId - User performing the update
 * @returns {Promise<Visit>} Updated visit document
 */
async function updateVisitIOP(visitId, iopData, userId) {
  validateObjectId(visitId, 'Visit ID');
  validateObjectId(userId, 'User ID');

  if (!iopData || typeof iopData !== 'object') {
    const error = new Error('Les données de tension oculaire sont requises');
    error.statusCode = 400;
    throw error;
  }

  // IOP validation (0-60 mmHg range)
  validateIOPValue(iopData.OD?.value || iopData.OD, 'OD');
  validateIOPValue(iopData.OS?.value || iopData.OS, 'OS');

  const update = {
    $set: {
      'examinations.iop': iopData,
      updatedBy: userId,
      updatedAt: new Date()
    }
  };

  const visit = await Visit.findByIdAndUpdate(
    visitId,
    update,
    {
      new: true,
      runValidators: false
    }
  );

  if (!visit) {
    const error = new Error('Visite non trouvée');
    error.statusCode = 404;
    throw error;
  }

  const iopOD = iopData.OD?.value || iopData.OD;
  const iopOS = iopData.OS?.value || iopData.OS;

  log.info('IOP updated', {
    visitId: visit.visitId || visit._id,
    userId,
    iopOD,
    iopOS,
    method: iopData.method
  });

  return visit;
}

// ============================================
// EXTENDED GRANULAR UPDATE METHODS
// Additional methods for MedFlow's ophthalmology workflow
// ============================================

/**
 * Update visual acuity ONLY
 * Additional granular method for StudioVision workflow
 *
 * @param {string} visitId - Visit MongoDB ID
 * @param {Object} vaData - Visual acuity data (Monoyer/Parinaud scales)
 * @param {string} userId - User performing the update
 * @returns {Promise<Visit>} Updated visit document
 */
async function updateVisitVisualAcuity(visitId, vaData, userId) {
  validateObjectId(visitId, 'Visit ID');
  validateObjectId(userId, 'User ID');

  if (!vaData || typeof vaData !== 'object') {
    const error = new Error('Les données d\'acuité visuelle sont requises');
    error.statusCode = 400;
    throw error;
  }

  const update = {
    $set: {
      'examinations.visualAcuity': vaData,
      updatedBy: userId,
      updatedAt: new Date()
    }
  };

  const visit = await Visit.findByIdAndUpdate(
    visitId,
    update,
    {
      new: true,
      runValidators: false
    }
  );

  if (!visit) {
    const error = new Error('Visite non trouvée');
    error.statusCode = 404;
    throw error;
  }

  log.info('Visual acuity updated', {
    visitId: visit.visitId || visit._id,
    userId
  });

  return visit;
}

/**
 * Update anterior segment examination ONLY
 *
 * @param {string} visitId - Visit MongoDB ID
 * @param {Object} anteriorData - Anterior segment examination data
 * @param {string} userId - User performing the update
 * @returns {Promise<Visit>} Updated visit document
 */
async function updateVisitAnteriorSegment(visitId, anteriorData, userId) {
  validateObjectId(visitId, 'Visit ID');
  validateObjectId(userId, 'User ID');

  if (!anteriorData || typeof anteriorData !== 'object') {
    const error = new Error('Les données du segment antérieur sont requises');
    error.statusCode = 400;
    throw error;
  }

  const update = {
    $set: {
      'examinations.anteriorSegment': anteriorData,
      updatedBy: userId,
      updatedAt: new Date()
    }
  };

  const visit = await Visit.findByIdAndUpdate(
    visitId,
    update,
    {
      new: true,
      runValidators: false
    }
  );

  if (!visit) {
    const error = new Error('Visite non trouvée');
    error.statusCode = 404;
    throw error;
  }

  log.info('Anterior segment updated', {
    visitId: visit.visitId || visit._id,
    userId
  });

  return visit;
}

/**
 * Update posterior segment/fundus examination ONLY
 *
 * @param {string} visitId - Visit MongoDB ID
 * @param {Object} posteriorData - Posterior segment examination data
 * @param {string} userId - User performing the update
 * @returns {Promise<Visit>} Updated visit document
 */
async function updateVisitPosteriorSegment(visitId, posteriorData, userId) {
  validateObjectId(visitId, 'Visit ID');
  validateObjectId(userId, 'User ID');

  if (!posteriorData || typeof posteriorData !== 'object') {
    const error = new Error('Les données du segment postérieur sont requises');
    error.statusCode = 400;
    throw error;
  }

  const update = {
    $set: {
      'examinations.posteriorSegment': posteriorData,
      updatedBy: userId,
      updatedAt: new Date()
    }
  };

  const visit = await Visit.findByIdAndUpdate(
    visitId,
    update,
    {
      new: true,
      runValidators: false
    }
  );

  if (!visit) {
    const error = new Error('Visite non trouvée');
    error.statusCode = 404;
    throw error;
  }

  log.info('Posterior segment updated', {
    visitId: visit.visitId || visit._id,
    userId
  });

  return visit;
}

/**
 * Update keratometry data ONLY
 *
 * @param {string} visitId - Visit MongoDB ID
 * @param {Object} keratometryData - Keratometry data with OD/OS values
 * @param {string} userId - User performing the update
 * @returns {Promise<Visit>} Updated visit document
 */
async function updateVisitKeratometry(visitId, keratometryData, userId) {
  validateObjectId(visitId, 'Visit ID');
  validateObjectId(userId, 'User ID');

  if (!keratometryData || typeof keratometryData !== 'object') {
    const error = new Error('Les données de kératométrie sont requises');
    error.statusCode = 400;
    throw error;
  }

  const update = {
    $set: {
      'examinations.keratometry': keratometryData,
      updatedBy: userId,
      updatedAt: new Date()
    }
  };

  const visit = await Visit.findByIdAndUpdate(
    visitId,
    update,
    {
      new: true,
      runValidators: false
    }
  );

  if (!visit) {
    const error = new Error('Visite non trouvée');
    error.statusCode = 404;
    throw error;
  }

  log.info('Keratometry updated', {
    visitId: visit.visitId || visit._id,
    userId
  });

  return visit;
}

/**
 * Update pathology findings ONLY
 * Template-based clinical findings from PathologyTemplate
 *
 * @param {string} visitId - Visit MongoDB ID
 * @param {Array} pathologyData - Array of pathology finding objects
 * @param {string} userId - User performing the update
 * @returns {Promise<Visit>} Updated visit document
 */
async function updateVisitPathologyFindings(visitId, pathologyData, userId) {
  validateObjectId(visitId, 'Visit ID');
  validateObjectId(userId, 'User ID');

  if (pathologyData !== undefined && pathologyData !== null && !Array.isArray(pathologyData)) {
    const error = new Error('Les constats pathologiques doivent être un tableau');
    error.statusCode = 400;
    throw error;
  }

  const update = {
    $set: {
      pathologyFindings: pathologyData || [],
      updatedBy: userId,
      updatedAt: new Date()
    }
  };

  const visit = await Visit.findByIdAndUpdate(
    visitId,
    update,
    {
      new: true,
      runValidators: false
    }
  );

  if (!visit) {
    const error = new Error('Visite non trouvée');
    error.statusCode = 404;
    throw error;
  }

  log.info('Pathology findings updated', {
    visitId: visit.visitId || visit._id,
    userId,
    findingsCount: pathologyData?.length || 0
  });

  return visit;
}

/**
 * Update clinical notes ONLY
 *
 * @param {string} visitId - Visit MongoDB ID
 * @param {Object} notesData - Notes data with clinical, internal, nursing, administrative
 * @param {string} userId - User performing the update
 * @returns {Promise<Visit>} Updated visit document
 */
async function updateVisitNotes(visitId, notesData, userId) {
  validateObjectId(visitId, 'Visit ID');
  validateObjectId(userId, 'User ID');

  if (!notesData || typeof notesData !== 'object') {
    const error = new Error('Les données de notes sont requises');
    error.statusCode = 400;
    throw error;
  }

  const updateFields = {
    updatedBy: userId,
    updatedAt: new Date()
  };

  // Allow updating specific note types
  if (notesData.clinical !== undefined) {
    updateFields['notes.clinical'] = notesData.clinical;
  }
  if (notesData.internal !== undefined) {
    updateFields['notes.internal'] = notesData.internal;
  }
  if (notesData.nursing !== undefined) {
    updateFields['notes.nursing'] = notesData.nursing;
  }
  if (notesData.administrative !== undefined) {
    updateFields['notes.administrative'] = notesData.administrative;
  }

  const visit = await Visit.findByIdAndUpdate(
    visitId,
    { $set: updateFields },
    {
      new: true,
      runValidators: false
    }
  );

  if (!visit) {
    const error = new Error('Visite non trouvée');
    error.statusCode = 404;
    throw error;
  }

  log.info('Notes updated', {
    visitId: visit.visitId || visit._id,
    userId
  });

  return visit;
}

/**
 * Update chief complaint and HPI ONLY
 *
 * @param {string} visitId - Visit MongoDB ID
 * @param {Object} complaintData - Chief complaint and HPI data
 * @param {string} userId - User performing the update
 * @returns {Promise<Visit>} Updated visit document
 */
async function updateVisitChiefComplaint(visitId, complaintData, userId) {
  validateObjectId(visitId, 'Visit ID');
  validateObjectId(userId, 'User ID');

  if (!complaintData || typeof complaintData !== 'object') {
    const error = new Error('Les données du motif de consultation sont requises');
    error.statusCode = 400;
    throw error;
  }

  const updateFields = {
    updatedBy: userId,
    updatedAt: new Date()
  };

  if (complaintData.chiefComplaint !== undefined) {
    updateFields.chiefComplaint = complaintData.chiefComplaint;
  }
  if (complaintData.historyOfPresentIllness !== undefined) {
    updateFields.historyOfPresentIllness = complaintData.historyOfPresentIllness;
  }

  const visit = await Visit.findByIdAndUpdate(
    visitId,
    { $set: updateFields },
    {
      new: true,
      runValidators: false
    }
  );

  if (!visit) {
    const error = new Error('Visite non trouvée');
    error.statusCode = 404;
    throw error;
  }

  log.info('Chief complaint updated', {
    visitId: visit.visitId || visit._id,
    userId
  });

  return visit;
}

/**
 * Link prescription to visit
 * Uses $push to add prescription without triggering pre-save hooks
 *
 * @param {string} visitId - Visit MongoDB ID
 * @param {string} prescriptionId - Prescription MongoDB ID to link
 * @param {string} userId - User performing the update
 * @returns {Promise<Visit>} Updated visit document
 */
async function linkPrescriptionToVisit(visitId, prescriptionId, userId) {
  validateObjectId(visitId, 'Visit ID');
  validateObjectId(prescriptionId, 'Prescription ID');
  validateObjectId(userId, 'User ID');

  const visit = await Visit.findByIdAndUpdate(
    visitId,
    {
      $addToSet: { prescriptions: prescriptionId },
      $set: {
        updatedBy: userId,
        updatedAt: new Date()
      }
    },
    {
      new: true,
      runValidators: false
    }
  );

  if (!visit) {
    const error = new Error('Visite non trouvée');
    error.statusCode = 404;
    throw error;
  }

  log.info('Prescription linked to visit', {
    visitId: visit.visitId || visit._id,
    prescriptionId,
    userId
  });

  return visit;
}

/**
 * Link IVT treatment to visit
 *
 * @param {string} visitId - Visit MongoDB ID
 * @param {string} ivtId - IVT injection MongoDB ID to link
 * @param {string} userId - User performing the update
 * @returns {Promise<Visit>} Updated visit document
 */
async function linkIVTToVisit(visitId, ivtId, userId) {
  validateObjectId(visitId, 'Visit ID');
  validateObjectId(ivtId, 'IVT ID');
  validateObjectId(userId, 'User ID');

  const visit = await Visit.findByIdAndUpdate(
    visitId,
    {
      $addToSet: { ivtTreatments: ivtId },
      $set: {
        updatedBy: userId,
        updatedAt: new Date()
      }
    },
    {
      new: true,
      runValidators: false
    }
  );

  if (!visit) {
    const error = new Error('Visite non trouvée');
    error.statusCode = 404;
    throw error;
  }

  log.info('IVT linked to visit', {
    visitId: visit.visitId || visit._id,
    ivtId,
    userId
  });

  return visit;
}

// ============================================
// MODULE EXPORTS
// ============================================

module.exports = {
  // Core methods (matching CareVision's DonConsultation.cs)
  updateVisitRefraction,      // ModifierConsultationRefrac
  updateVisitDiagnosis,       // ModifierConsultationPathologie
  updateVisitTreatment,       // ModifierConsultationTraite
  updateVisitIOP,             // ModifierConsultationRefra (TOD/TOG)

  // Extended methods for MedFlow's ophthalmology workflow
  updateVisitVisualAcuity,
  updateVisitAnteriorSegment,
  updateVisitPosteriorSegment,
  updateVisitKeratometry,
  updateVisitPathologyFindings,
  updateVisitNotes,
  updateVisitChiefComplaint,

  // Link methods
  linkPrescriptionToVisit,
  linkIVTToVisit,

  // Validation helpers (exported for testing)
  validateObjectId,
  validateIOPValue,
  validateVisualAcuityValue,
  validateSphereValue,
  validateCylinderValue,
  validateAxisValue,
  validateAdditionValue,
  validateRefractionEye
};
