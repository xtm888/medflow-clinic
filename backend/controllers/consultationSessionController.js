const ConsultationSession = require('../models/ConsultationSession');

/**
 * Get active session for patient
 */
exports.getActiveSession = async (req, res) => {
  try {
    const { patientId } = req.params;

    const session = await ConsultationSession.getActiveSession(patientId, req.user._id);

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
 */
exports.getRecentSessions = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const sessions = await ConsultationSession.getRecentSessions(req.user._id, limit);

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
 */
exports.createSession = async (req, res) => {
  try {
    const sessionData = {
      ...req.body,
      doctor: req.user._id
    };

    // Check if there's already an active session for this patient
    const existingSession = await ConsultationSession.getActiveSession(
      sessionData.patient,
      req.user._id
    );

    if (existingSession) {
      return res.status(400).json({
        success: false,
        message: 'An active session already exists for this patient',
        data: existingSession
      });
    }

    const session = new ConsultationSession(sessionData);
    await session.save();

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
