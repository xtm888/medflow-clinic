const ConsultationSession = require('../models/ConsultationSession');
const { asyncHandler } = require('../middleware/errorHandler');
const { buildClinicQuery } = require('../middleware/clinicAuth');

/**
 * Get active session for patient
 * MULTI-CLINIC: Sessions are scoped to the current clinic context
 */
exports.getActiveSession = async (req, res) => {
  try {
    const { patientId } = req.params;

    // MULTI-CLINIC: Pass clinic context to filter sessions
    const session = await ConsultationSession.getActiveSession(patientId, req.user._id, req.clinicId);

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error getting active session:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving active session',
      error: error.message
    });
  }
};

/**
 * Get recent sessions for doctor
 * MULTI-CLINIC: Sessions filtered by current clinic context
 */
exports.getRecentSessions = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // MULTI-CLINIC: Pass clinic context to filter sessions
    const sessions = await ConsultationSession.getRecentSessions(req.user._id, req.clinicId, limit);

    res.json({
      success: true,
      count: sessions.length,
      data: sessions
    });
  } catch (error) {
    console.error('Error getting recent sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving recent sessions',
      error: error.message
    });
  }
};

/**
 * Get session by ID
 */
exports.getSessionById = async (req, res) => {
  try {
    const session = await ConsultationSession.findById(req.params.id)
      .populate('patient', 'firstName lastName patientId')
      .populate('doctor', 'firstName lastName')
      .populate('visit');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Consultation session not found'
      });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving consultation session',
      error: error.message
    });
  }
};

/**
 * Create new consultation session
 * MULTI-CLINIC: Session is created for the current clinic context
 */
exports.createSession = async (req, res) => {
  try {
    // MULTI-CLINIC: Determine clinic context
    let clinicId = req.clinicId;

    // If admin in "All Clinics" mode, try to get clinic from patient
    if (!clinicId && req.accessAllClinics) {
      const Patient = require('../models/Patient');
      const patient = await Patient.findById(req.body.patient);
      if (patient && patient.homeClinic) {
        clinicId = patient.homeClinic;
      } else if (req.user.primaryClinic) {
        // Fallback to admin's primary clinic
        clinicId = req.user.primaryClinic;
      }
    }

    if (!clinicId) {
      return res.status(400).json({
        success: false,
        message: 'Please select a specific clinic before starting a consultation, or ensure the patient has a home clinic assigned.'
      });
    }

    const sessionData = {
      ...req.body,
      clinic: clinicId, // MULTI-CLINIC: Assign clinic to session
      doctor: req.user._id
    };

    // Check if there's already an active session for this patient at this clinic
    const existingSession = await ConsultationSession.getActiveSession(
      sessionData.patient,
      req.user._id,
      clinicId // MULTI-CLINIC: Check within same clinic
    );

    if (existingSession) {
      return res.status(400).json({
        success: false,
        message: 'An active session already exists for this patient at this clinic',
        data: existingSession
      });
    }

    const session = new ConsultationSession(sessionData);
    await session.save();

    await session.populate('clinic', 'clinicId name shortName');
    await session.populate('patient', 'firstName lastName patientId');
    await session.populate('doctor', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Consultation session created successfully',
      data: session
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating consultation session',
      error: error.message
    });
  }
};

/**
 * Update consultation session (auto-save)
 */
exports.updateSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { isAutoSave, ...updateData } = req.body;

    const session = await ConsultationSession.findById(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Consultation session not found'
      });
    }

    // Check ownership
    if (session.doctor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this session'
      });
    }

    // Update fields
    Object.assign(session, updateData);

    // Track save type
    if (isAutoSave) {
      await session.autoSave();
    } else {
      session.lastManualSave = new Date();
      session.lastSavedBy = req.user._id;
      await session.save();
    }

    await session.populate('patient', 'firstName lastName patientId');
    await session.populate('doctor', 'firstName lastName');

    res.json({
      success: true,
      message: isAutoSave ? 'Session auto-saved' : 'Session saved successfully',
      data: session
    });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating consultation session',
      error: error.message
    });
  }
};

/**
 * Complete consultation session
 */
exports.completeSession = async (req, res) => {
  try {
    const session = await ConsultationSession.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Consultation session not found'
      });
    }

    // Check ownership
    if (session.doctor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to complete this session'
      });
    }

    // Update session with final data if provided (for dashboard mode)
    if (req.body && Object.keys(req.body).length > 0) {
      // CRITICAL FIX: Filter out 'status' from req.body to prevent accidentally
      // overriding session.status with invalid enum values from frontend data
      const { status, ...safeData } = req.body;
      if (status && status !== 'active') {
        console.warn(`[COMPLETE SESSION] Ignoring status="${status}" from frontend to prevent validation errors`);
      }
      Object.assign(session, safeData);
      await session.save();
    }

    await session.complete(req.user._id);

    await session.populate('patient', 'firstName lastName patientId');
    await session.populate('doctor', 'firstName lastName');

    res.json({
      success: true,
      message: 'Consultation session completed successfully',
      data: session
    });
  } catch (error) {
    console.error('Error completing session:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing consultation session',
      error: error.message
    });
  }
};

/**
 * Abandon consultation session
 */
exports.abandonSession = async (req, res) => {
  try {
    const session = await ConsultationSession.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Consultation session not found'
      });
    }

    // Check ownership
    if (session.doctor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to abandon this session'
      });
    }

    await session.abandon();

    res.json({
      success: true,
      message: 'Consultation session abandoned'
    });
  } catch (error) {
    console.error('Error abandoning session:', error);
    res.status(500).json({
      success: false,
      message: 'Error abandoning consultation session',
      error: error.message
    });
  }
};

/**
 * Delete consultation session
 */
exports.deleteSession = async (req, res) => {
  try {
    const session = await ConsultationSession.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Consultation session not found'
      });
    }

    // Check ownership or admin
    if (session.doctor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this session'
      });
    }

    await session.deleteOne();

    res.json({
      success: true,
      message: 'Consultation session deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting consultation session',
      error: error.message
    });
  }
};
