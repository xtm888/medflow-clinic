/**
 * Clinical Alert Controller
 *
 * Handles clinical alert management for ophthalmology workflows.
 */

const ClinicalAlert = require('../models/ClinicalAlert');
const OphthalmologyExam = require('../models/OphthalmologyExam');
const Patient = require('../models/Patient');
const clinicalAlertService = require('../services/clinicalAlertService');
const mongoose = require('mongoose');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Get active alerts for a patient
 * GET /api/clinical-alerts/patient/:patientId
 */
exports.getPatientAlerts = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { severity, limit, includeAcknowledged } = req.query;

  const options = {
    severity,
    limit: limit ? parseInt(limit) : 50
  };

  const alerts = await clinicalAlertService.getPatientAlerts(patientId, options);

  // Group by severity for frontend convenience
  const grouped = {
    EMERGENCY: alerts.filter(a => a.severity === 'EMERGENCY'),
    URGENT: alerts.filter(a => a.severity === 'URGENT'),
    WARNING: alerts.filter(a => a.severity === 'WARNING'),
    INFO: alerts.filter(a => a.severity === 'INFO')
  };

  res.json({
    success: true,
    data: {
      alerts,
      grouped,
      total: alerts.length,
      hasEmergency: grouped.EMERGENCY.length > 0,
      hasUrgent: grouped.URGENT.length > 0
    }
  });
});

/**
 * Get alert counts by severity for a patient
 * GET /api/clinical-alerts/patient/:patientId/counts
 */
exports.getAlertCounts = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const counts = await clinicalAlertService.getAlertCounts(patientId);

  res.json({
    success: true,
    data: counts
  });
});

/**
 * Get emergency alerts for a patient (for blocking modal)
 * GET /api/clinical-alerts/patient/:patientId/emergency
 */
exports.getEmergencyAlerts = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  const alerts = await ClinicalAlert.find({
    patient: patientId,
    severity: 'EMERGENCY',
    status: 'active'
  })
  .sort({ priority: 1, createdAt: -1 })
  .lean();

  res.json({
    success: true,
    data: {
      alerts,
      hasBlockingAlerts: alerts.length > 0,
      count: alerts.length
    }
  });
});

/**
 * Get alerts for specific exam
 * GET /api/clinical-alerts/exam/:examId
 */
exports.getExamAlerts = async (req, res) => {
  try {
    const { examId } = req.params;

    const alerts = await ClinicalAlert.find({
      exam: examId,
      status: { $in: ['active', 'acknowledged'] }
    })
    .sort({ priority: 1, createdAt: -1 })
    .populate('acknowledgedBy', 'firstName lastName')
    .lean();

    // Group by severity
    const grouped = {
      EMERGENCY: alerts.filter(a => a.severity === 'EMERGENCY'),
      URGENT: alerts.filter(a => a.severity === 'URGENT'),
      WARNING: alerts.filter(a => a.severity === 'WARNING'),
      INFO: alerts.filter(a => a.severity === 'INFO')
    };

    res.json({
      success: true,
      data: {
        alerts,
        grouped,
        total: alerts.length,
        hasBlockingAlerts: grouped.EMERGENCY.length > 0
      }
    });
  } catch (error) {
    console.error('Error getting exam alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get exam alerts',
      error: error.message
    });
  }
};

/**
 * Evaluate alerts for exam data
 * POST /api/clinical-alerts/exam/:examId/evaluate
 */
exports.evaluateExamAlerts = async (req, res) => {
  try {
    const { examId } = req.params;
    const { examData } = req.body;

    // Get the exam
    const exam = await OphthalmologyExam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    // Get patient data
    const patient = await Patient.findById(exam.patient).lean();
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Get previous exam for comparison
    const previousExam = await OphthalmologyExam.findOne({
      patient: exam.patient,
      _id: { $ne: examId },
      status: 'completed'
    })
    .sort({ createdAt: -1 })
    .lean();

    // Use provided examData or fall back to exam document
    const dataToEvaluate = examData || exam.toObject();

    // Evaluate and create alerts
    const alerts = await clinicalAlertService.evaluateAndCreateAlerts(
      dataToEvaluate,
      exam.patient,
      examId,
      exam.visit,
      previousExam,
      patient,
      req.user._id
    );

    // Get all active alerts for the exam
    const allAlerts = await ClinicalAlert.find({
      exam: examId,
      status: { $in: ['active', 'acknowledged'] }
    })
    .sort({ priority: 1, createdAt: -1 })
    .lean();

    const hasBlockingAlerts = allAlerts.some(a => a.severity === 'EMERGENCY' && a.status === 'active');

    res.json({
      success: true,
      data: {
        newAlerts: alerts,
        newCount: alerts.length,
        allAlerts,
        totalCount: allAlerts.length,
        hasBlockingAlerts,
        mustAcknowledge: hasBlockingAlerts
      }
    });
  } catch (error) {
    console.error('Error evaluating exam alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to evaluate alerts',
      error: error.message
    });
  }
};

/**
 * Re-evaluate alerts after exam data changes
 * POST /api/clinical-alerts/exam/:examId/re-evaluate
 */
exports.reEvaluateExamAlerts = async (req, res) => {
  try {
    const { examId } = req.params;
    const { examData } = req.body;

    // Get the exam
    const exam = await OphthalmologyExam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    // Get patient data
    const patient = await Patient.findById(exam.patient).lean();

    // Get previous exam for comparison
    const previousExam = await OphthalmologyExam.findOne({
      patient: exam.patient,
      _id: { $ne: examId },
      status: 'completed'
    })
    .sort({ createdAt: -1 })
    .lean();

    const dataToEvaluate = examData || exam.toObject();

    // Re-evaluate alerts
    const newAlerts = await clinicalAlertService.reEvaluateAlerts(
      dataToEvaluate,
      exam.patient,
      examId,
      exam.visit,
      previousExam,
      patient,
      req.user._id
    );

    // Get all active alerts for the exam
    const allAlerts = await ClinicalAlert.find({
      exam: examId,
      status: { $in: ['active', 'acknowledged'] }
    })
    .sort({ priority: 1, createdAt: -1 })
    .lean();

    res.json({
      success: true,
      data: {
        newAlerts,
        allAlerts,
        hasBlockingAlerts: allAlerts.some(a => a.severity === 'EMERGENCY' && a.status === 'active')
      }
    });
  } catch (error) {
    console.error('Error re-evaluating alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to re-evaluate alerts',
      error: error.message
    });
  }
};

/**
 * Get single alert by ID
 * GET /api/clinical-alerts/:id
 */
exports.getAlertById = async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await ClinicalAlert.findById(id)
      .populate('patient', 'firstName lastName dateOfBirth patientId')
      .populate('acknowledgedBy', 'firstName lastName')
      .populate('resolvedBy', 'firstName lastName')
      .populate('escalatedTo', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .lean();

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    console.error('Error getting alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get alert',
      error: error.message
    });
  }
};

/**
 * Acknowledge an alert
 * POST /api/clinical-alerts/:id/acknowledge
 */
exports.acknowledgeAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const alert = await clinicalAlertService.acknowledgeAlert(id, req.user._id, reason);

    res.json({
      success: true,
      message: 'Alert acknowledged',
      data: alert
    });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(error.message === 'Alert not found' ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to acknowledge alert'
    });
  }
};

/**
 * Resolve an alert
 * POST /api/clinical-alerts/:id/resolve
 */
exports.resolveAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;

    const alert = await clinicalAlertService.resolveAlert(id, req.user._id, resolution);

    res.json({
      success: true,
      message: 'Alert resolved',
      data: alert
    });
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(error.message === 'Alert not found' ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to resolve alert'
    });
  }
};

/**
 * Escalate an alert
 * POST /api/clinical-alerts/:id/escalate
 */
exports.escalateAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { toUserId, reason } = req.body;

    if (!toUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID is required'
      });
    }

    const alert = await clinicalAlertService.escalateAlert(id, req.user._id, toUserId, reason);

    res.json({
      success: true,
      message: 'Alert escalated',
      data: alert
    });
  } catch (error) {
    console.error('Error escalating alert:', error);
    res.status(error.message === 'Alert not found' ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to escalate alert'
    });
  }
};

/**
 * Dismiss an alert
 * POST /api/clinical-alerts/:id/dismiss
 * NOTE: EMERGENCY alerts cannot be dismissed - they must be acknowledged or resolved
 */
exports.dismissAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const alert = await clinicalAlertService.dismissAlert(id, req.user._id, reason);

    res.json({
      success: true,
      message: 'Alert dismissed',
      data: alert
    });
  } catch (error) {
    console.error('Error dismissing alert:', error);

    // Handle specific error codes for better client-side handling
    let statusCode = 500;
    if (error.message === 'Alert not found') {
      statusCode = 404;
    } else if (error.code === 'EMERGENCY_CANNOT_DISMISS') {
      statusCode = 403;
    } else if (error.code === 'REASON_REQUIRED') {
      statusCode = 400;
    } else if (error.status) {
      statusCode = error.status;
    }

    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to dismiss alert',
      code: error.code
    });
  }
};

/**
 * Acknowledge an EMERGENCY alert with required documentation
 * POST /api/clinical-alerts/:id/acknowledge-emergency
 * Requires: reason, clinicalJustification
 * Optional: actionsTaken[]
 */
exports.acknowledgeEmergencyAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, clinicalJustification, actionsTaken } = req.body;

    const alert = await clinicalAlertService.acknowledgeEmergencyAlert(id, req.user._id, {
      reason,
      clinicalJustification,
      actionsTaken
    });

    res.json({
      success: true,
      message: 'Emergency alert acknowledged with documentation',
      data: alert
    });
  } catch (error) {
    console.error('Error acknowledging emergency alert:', error);

    let statusCode = 500;
    if (error.message === 'Alert not found') {
      statusCode = 404;
    } else if (error.code === 'REASON_REQUIRED' || error.code === 'JUSTIFICATION_REQUIRED') {
      statusCode = 400;
    } else if (error.status) {
      statusCode = error.status;
    }

    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to acknowledge emergency alert',
      code: error.code
    });
  }
};

/**
 * Mark a recommended action as complete
 * POST /api/clinical-alerts/:id/complete-action
 */
exports.completeRecommendedAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { actionIndex } = req.body;

    const alert = await ClinicalAlert.findById(id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    if (actionIndex < 0 || actionIndex >= alert.recommendedActions.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action index'
      });
    }

    alert.recommendedActions[actionIndex].completed = true;
    alert.recommendedActions[actionIndex].completedAt = new Date();
    alert.recommendedActions[actionIndex].completedBy = req.user._id;

    await alert.save();

    res.json({
      success: true,
      message: 'Action marked as complete',
      data: alert
    });
  } catch (error) {
    console.error('Error completing action:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete action',
      error: error.message
    });
  }
};

/**
 * Bulk acknowledge alerts
 * POST /api/clinical-alerts/bulk-acknowledge
 */
exports.bulkAcknowledge = async (req, res) => {
  try {
    const { alertIds, reason } = req.body;

    if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Alert IDs array is required'
      });
    }

    const results = await clinicalAlertService.bulkAcknowledge(alertIds, req.user._id, reason);

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Acknowledged ${successCount} alerts${failCount > 0 ? `, ${failCount} failed` : ''}`,
      data: {
        results,
        successCount,
        failCount
      }
    });
  } catch (error) {
    console.error('Error bulk acknowledging alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk acknowledge alerts',
      error: error.message
    });
  }
};

/**
 * Create a manual alert
 * POST /api/clinical-alerts
 */
exports.createManualAlert = async (req, res) => {
  try {
    const alertData = req.body;

    // Validate required fields
    if (!alertData.patient || !alertData.severity || !alertData.code || !alertData.title || !alertData.message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: patient, severity, code, title, message'
      });
    }

    const alert = await clinicalAlertService.createManualAlert(alertData, req.user._id);

    res.status(201).json({
      success: true,
      message: 'Alert created',
      data: alert
    });
  } catch (error) {
    console.error('Error creating manual alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create alert',
      error: error.message
    });
  }
};

/**
 * Get available alert rules (for configuration UI)
 * GET /api/clinical-alerts/config/rules
 */
exports.getAlertRules = async (req, res) => {
  try {
    const rules = clinicalAlertService.getAlertRules();

    // Group by severity
    const grouped = {
      EMERGENCY: rules.filter(r => r.severity === 'EMERGENCY'),
      URGENT: rules.filter(r => r.severity === 'URGENT'),
      WARNING: rules.filter(r => r.severity === 'WARNING'),
      INFO: rules.filter(r => r.severity === 'INFO')
    };

    res.json({
      success: true,
      data: {
        rules,
        grouped,
        total: rules.length
      }
    });
  } catch (error) {
    console.error('Error getting alert rules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get alert rules',
      error: error.message
    });
  }
};
