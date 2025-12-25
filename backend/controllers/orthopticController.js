const mongoose = require('mongoose');
const OrthopticExam = require('../models/OrthopticExam');
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const AuditLog = require('../models/AuditLog');
const { asyncHandler } = require('../middleware/errorHandler');
const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('OrthopticController');

// Helper function to log actions directly
const logAuditAction = async (req, action, metadata = {}) => {
  try {
    await AuditLog.create({
      user: req.user ? req.user._id : null,
      action,
      resource: req.originalUrl,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata,
      responseStatus: 200
    });
  } catch (error) {
    log.error('Audit logging error', { error: error.message });
  }
};

// Helper function to log patient data access
const logPatientAccess = async (req, patientId, accessType, resourceType) => {
  try {
    await AuditLog.create({
      user: req.user ? req.user._id : null,
      action: 'PATIENT_DATA_ACCESS',
      resource: req.originalUrl,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        patientId,
        accessType,
        resourceType,
        department: req.user?.department
      },
      responseStatus: 200
    });
  } catch (error) {
    log.error('Patient access logging error', { error: error.message });
  }
};

// @desc    Create new orthoptic examination
// @route   POST /api/orthoptic
// @access  Private (nurse, ophthalmologist, doctor)
exports.createOrthopticExam = async (req, res) => {
  try {
    const {
      patientId,
      visitId,
      examType,
      sessionInfo,
      visualAcuity,
      motility,
      synoptophore,
      stereopsis,
      worthTest,
      redGlassTest,
      bagoliniTest,
      postImagesTest,
      physiologicalDiplopia,
      coverTest,
      maddoxTest,
      nearPointConvergence,
      convergenceReflex,
      vergences,
      hessLancaster,
      functionalSigns,
      treatment,
      diagnosis,
      conclusion,
      notes
    } = req.body;

    // Validate patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Validate visit if provided
    if (visitId) {
      const visit = await Visit.findById(visitId);
      if (!visit) {
        return res.status(404).json({ message: 'Visit not found' });
      }
    }

    // Create orthoptic exam
    const orthopticExam = await OrthopticExam.create({
      patient: patientId,
      visit: visitId,
      examiner: req.user._id,
      examDate: new Date(),
      examType: examType || 'initial',
      sessionInfo,
      visualAcuity,
      motility,
      synoptophore,
      stereopsis,
      worthTest,
      redGlassTest,
      bagoliniTest,
      postImagesTest,
      physiologicalDiplopia,
      coverTest,
      maddoxTest,
      nearPointConvergence,
      convergenceReflex,
      vergences,
      hessLancaster,
      functionalSigns,
      treatment,
      diagnosis,
      conclusion,
      notes,
      status: 'in-progress'
    });

    // Log the action
    await logAuditAction(req, 'CREATE_ORTHOPTIC_EXAM', {
      examId: orthopticExam.examId,
      patientId: patient._id,
      examType
    });

    await logPatientAccess(req, patient._id, 'CREATE', 'OrthopticExam');

    // Populate examiner details
    await orthopticExam.populate('examiner', 'firstName lastName role');

    res.status(201).json({
      success: true,
      data: orthopticExam
    });
  } catch (error) {
    log.error('Error creating orthoptic exam', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Server error creating orthoptic examination',
      error: error.message
    });
  }
};

// @desc    Get all orthoptic examinations with filters
// @route   GET /api/orthoptic
// @access  Private
exports.getOrthopticExams = async (req, res) => {
  try {
    const {
      patientId,
      examinerId,
      status,
      examType,
      startDate,
      endDate,
      limit = 50,
      page = 1
    } = req.query;

    const query = {};

    if (patientId) query.patient = patientId;
    if (examinerId) query.examiner = examinerId;
    if (status) query.status = status;
    if (examType) query.examType = examType;

    if (startDate || endDate) {
      query.examDate = {};
      if (startDate) query.examDate.$gte = new Date(startDate);
      if (endDate) query.examDate.$lte = new Date(endDate);
    }

    const exams = await OrthopticExam.find(query)
      .sort({ examDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('patient', 'firstName lastName patientId dateOfBirth')
      .populate('examiner', 'firstName lastName role')
      .populate('visit');

    const total = await OrthopticExam.countDocuments(query);

    res.json({
      success: true,
      count: exams.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: exams
    });
  } catch (error) {
    log.error('Error fetching orthoptic exams', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Server error fetching orthoptic examinations',
      error: error.message
    });
  }
};

// @desc    Get single orthoptic examination
// @route   GET /api/orthoptic/:id
// @access  Private
exports.getOrthopticExam = async (req, res) => {
  try {
    const exam = await OrthopticExam.findById(req.params.id)
      .populate('patient')
      .populate('examiner', 'firstName lastName role')
      .populate('visit')
      .populate('sessionInfo.previousExam');

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Orthoptic examination not found'
      });
    }

    // Log patient data access
    await logPatientAccess(req, exam.patient._id, 'READ', 'OrthopticExam');

    res.json({
      success: true,
      data: exam
    });
  } catch (error) {
    log.error('Error fetching orthoptic exam', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Server error fetching orthoptic examination',
      error: error.message
    });
  }
};

// @desc    Update orthoptic examination
// @route   PUT /api/orthoptic/:id
// @access  Private
exports.updateOrthopticExam = async (req, res) => {
  try {
    let exam = await OrthopticExam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Orthoptic examination not found'
      });
    }

    // Check if exam is already signed
    if (exam.status === 'signed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a signed examination'
      });
    }

    // Update exam
    exam = await OrthopticExam.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('patient')
      .populate('examiner', 'firstName lastName role');

    // Log the action
    await logAuditAction(req, 'UPDATE_ORTHOPTIC_EXAM', {
      examId: exam.examId,
      patientId: exam.patient._id
    });

    await logPatientAccess(req, exam.patient._id, 'UPDATE', 'OrthopticExam');

    res.json({
      success: true,
      data: exam
    });
  } catch (error) {
    log.error('Error updating orthoptic exam', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Server error updating orthoptic examination',
      error: error.message
    });
  }
};

// @desc    Complete orthoptic examination
// @route   PUT /api/orthoptic/:id/complete
// @access  Private
exports.completeOrthopticExam = async (req, res) => {
  try {
    const exam = await OrthopticExam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Orthoptic examination not found'
      });
    }

    await exam.completeExam(req.user._id);

    // Log the action
    await logAuditAction(req, 'COMPLETE_ORTHOPTIC_EXAM', {
      examId: exam.examId,
      patientId: exam.patient
    });

    res.json({
      success: true,
      data: exam
    });
  } catch (error) {
    log.error('Error completing orthoptic exam', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Server error completing orthoptic examination',
      error: error.message
    });
  }
};

// @desc    Sign orthoptic examination
// @route   PUT /api/orthoptic/:id/sign
// @access  Private (ophthalmologist, doctor)
exports.signOrthopticExam = async (req, res) => {
  try {
    const exam = await OrthopticExam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Orthoptic examination not found'
      });
    }

    if (exam.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Examination must be completed before signing'
      });
    }

    await exam.signExam(req.user._id);

    // Log the action
    await logAuditAction(req, 'SIGN_ORTHOPTIC_EXAM', {
      examId: exam.examId,
      patientId: exam.patient
    });

    res.json({
      success: true,
      data: exam
    });
  } catch (error) {
    log.error('Error signing orthoptic exam', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Server error signing orthoptic examination',
      error: error.message
    });
  }
};

// @desc    Get patient's orthoptic exam history
// @route   GET /api/orthoptic/patient/:patientId/history
// @access  Private
exports.getPatientOrthopticHistory = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 10 } = req.query;

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const exams = await OrthopticExam.getPatientExams(patientId, parseInt(limit));

    // Log patient data access
    await logPatientAccess(req, patientId, 'READ', 'OrthopticExam');

    res.json({
      success: true,
      count: exams.length,
      data: exams
    });
  } catch (error) {
    log.error('Error fetching patient orthoptic history', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Server error fetching patient orthoptic history',
      error: error.message
    });
  }
};

// @desc    Get treatment progress for patient
// @route   GET /api/orthoptic/patient/:patientId/progress
// @access  Private
exports.getTreatmentProgress = async (req, res) => {
  try {
    const { patientId } = req.params;

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const progress = await OrthopticExam.getTreatmentProgress(patientId);

    // Log patient data access
    await logPatientAccess(req, patientId, 'READ', 'OrthopticExam');

    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    log.error('Error fetching treatment progress', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Server error fetching treatment progress',
      error: error.message
    });
  }
};

// @desc    Compare exam with previous
// @route   GET /api/orthoptic/:id/compare
// @access  Private
exports.compareWithPrevious = async (req, res) => {
  try {
    const exam = await OrthopticExam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Orthoptic examination not found'
      });
    }

    const comparison = await exam.compareWithPrevious();

    if (!comparison) {
      return res.status(404).json({
        success: false,
        message: 'No previous examination found for comparison'
      });
    }

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    log.error('Error comparing exams', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Server error comparing examinations',
      error: error.message
    });
  }
};

// @desc    Generate orthoptic exam report
// @route   GET /api/orthoptic/:id/report
// @access  Private
exports.generateReport = async (req, res) => {
  try {
    const { language = 'fr' } = req.query;

    const exam = await OrthopticExam.findById(req.params.id)
      .populate('patient')
      .populate('examiner', 'firstName lastName role');

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Orthoptic examination not found'
      });
    }

    const report = exam.generateReport(language);

    // Log the action
    await logAuditAction(req, 'GENERATE_ORTHOPTIC_REPORT', {
      examId: exam.examId,
      patientId: exam.patient._id,
      language
    });

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    log.error('Error generating report', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Server error generating report',
      error: error.message
    });
  }
};

// @desc    Delete orthoptic examination
// @route   DELETE /api/orthoptic/:id
// @access  Private (admin only)
exports.deleteOrthopticExam = async (req, res) => {
  try {
    const exam = await OrthopticExam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Orthoptic examination not found'
      });
    }

    // Only allow deletion of unsigned exams
    if (exam.status === 'signed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a signed examination'
      });
    }

    await exam.deleteOne();

    // Log the action
    await logAuditAction(req, 'DELETE_ORTHOPTIC_EXAM', {
      examId: exam.examId,
      patientId: exam.patient
    });

    res.json({
      success: true,
      message: 'Orthoptic examination deleted successfully'
    });
  } catch (error) {
    log.error('Error deleting orthoptic exam', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Server error deleting orthoptic examination',
      error: error.message
    });
  }
};

// @desc    Add attachment to orthoptic exam
// @route   POST /api/orthoptic/:id/attachments
// @access  Private
exports.addAttachment = async (req, res) => {
  try {
    const { type, url, description } = req.body;

    const exam = await OrthopticExam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Orthoptic examination not found'
      });
    }

    exam.attachments.push({
      type,
      url,
      description,
      uploadedAt: new Date()
    });

    await exam.save();

    res.json({
      success: true,
      data: exam
    });
  } catch (error) {
    log.error('Error adding attachment', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Server error adding attachment',
      error: error.message
    });
  }
};

// @desc    Get orthoptic exam statistics
// @route   GET /api/orthoptic/stats
// @access  Private
exports.getOrthopticStats = async (req, res) => {
  try {
    const { startDate, endDate, examinerId } = req.query;

    const matchStage = {};

    if (startDate || endDate) {
      matchStage.examDate = {};
      if (startDate) matchStage.examDate.$gte = new Date(startDate);
      if (endDate) matchStage.examDate.$lte = new Date(endDate);
    }

    if (examinerId) {
      matchStage.examiner = new mongoose.Types.ObjectId(examinerId);
    }

    const stats = await OrthopticExam.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalExams: { $sum: 1 },
          completedExams: {
            $sum: { $cond: [{ $in: ['$status', ['completed', 'signed']] }, 1, 0] }
          },
          signedExams: {
            $sum: { $cond: [{ $eq: ['$status', 'signed'] }, 1, 0] }
          },
          byExamType: {
            $push: '$examType'
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats.length > 0 ? stats[0] : {}
    });
  } catch (error) {
    log.error('Error fetching orthoptic stats', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Server error fetching statistics',
      error: error.message
    });
  }
};
