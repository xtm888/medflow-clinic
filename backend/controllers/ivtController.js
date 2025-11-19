const IVTInjection = require('../models/IVTInjection');
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const Appointment = require('../models/Appointment');
const { logAction, logPatientDataAccess, logCriticalOperation } = require('../middleware/auditLogger');

// @desc    Create new IVT injection record
// @route   POST /api/ivt
// @access  Private (ophthalmologist only)
exports.createIVTInjection = async (req, res) => {
  try {
    const { patientId, ...injectionData } = req.body;

    // Validate patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Get previous injection for this eye to establish series
    const previousInjection = await IVTInjection.findOne({
      patient: patientId,
      eye: injectionData.eye,
      status: 'completed'
    }).sort({ injectionDate: -1 });

    // Calculate series information
    const seriesInfo = {
      injectionNumber: injectionData.series?.injectionNumber || 1,
      protocol: injectionData.series?.protocol || 'loading',
      previousInjection: previousInjection?._id,
      initialInjection: previousInjection?.series?.initialInjection || null,
      totalInjectionsThisEye: previousInjection ? (previousInjection.series.totalInjectionsThisEye || 0) + 1 : 1
    };

    // Calculate interval from last injection
    if (previousInjection) {
      const daysDiff = Math.floor((new Date() - previousInjection.injectionDate) / (1000 * 60 * 60 * 24));
      seriesInfo.intervalFromLast = Math.round(daysDiff / 7); // weeks
    }

    // Create IVT injection
    const ivtInjection = await IVTInjection.create({
      patient: patientId,
      ...injectionData,
      series: {
        ...injectionData.series,
        ...seriesInfo
      },
      performedBy: req.user._id,
      status: 'scheduled'
    });

    // Log the action
    await logCriticalOperation(req, 'CREATE_IVT_INJECTION', {
      injectionId: ivtInjection.injectionId,
      patientId: patient._id,
      eye: ivtInjection.eye,
      medication: ivtInjection.medication.name
    });

    await logPatientDataAccess(req, patient._id, 'CREATE', 'IVTInjection');

    // Populate references
    await ivtInjection.populate('performedBy', 'firstName lastName role');
    await ivtInjection.populate('patient', 'firstName lastName patientId');

    res.status(201).json({
      success: true,
      data: ivtInjection
    });
  } catch (error) {
    console.error('Error creating IVT injection:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating IVT injection',
      error: error.message
    });
  }
};

// @desc    Get all IVT injections with filters
// @route   GET /api/ivt
// @access  Private
exports.getIVTInjections = async (req, res) => {
  try {
    const {
      patientId,
      eye,
      indication,
      medication,
      status,
      startDate,
      endDate,
      protocol,
      limit = 50,
      page = 1
    } = req.query;

    const query = {};

    if (patientId) query.patient = patientId;
    if (eye) query.eye = eye;
    if (indication) query['indication.primary'] = indication;
    if (medication) query['medication.name'] = new RegExp(medication, 'i');
    if (status) query.status = status;
    if (protocol) query['series.protocol'] = protocol;

    if (startDate || endDate) {
      query.injectionDate = {};
      if (startDate) query.injectionDate.$gte = new Date(startDate);
      if (endDate) query.injectionDate.$lte = new Date(endDate);
    }

    const injections = await IVTInjection.find(query)
      .sort({ injectionDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('patient', 'firstName lastName patientId dateOfBirth')
      .populate('performedBy', 'firstName lastName role')
      .populate('visit')
      .populate('series.previousInjection', 'injectionDate medication.name');

    const total = await IVTInjection.countDocuments(query);

    res.json({
      success: true,
      count: injections.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: injections
    });
  } catch (error) {
    console.error('Error fetching IVT injections:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching IVT injections',
      error: error.message
    });
  }
};

// @desc    Get single IVT injection
// @route   GET /api/ivt/:id
// @access  Private
exports.getIVTInjection = async (req, res) => {
  try {
    const injection = await IVTInjection.findById(req.params.id)
      .populate('patient')
      .populate('performedBy', 'firstName lastName role')
      .populate('assistedBy', 'firstName lastName role')
      .populate('visit')
      .populate('appointment')
      .populate('series.previousInjection')
      .populate('series.initialInjection')
      .populate('consent.obtainedBy', 'firstName lastName');

    if (!injection) {
      return res.status(404).json({
        success: false,
        message: 'IVT injection not found'
      });
    }

    // Log patient data access
    await logPatientDataAccess(req, injection.patient._id, 'READ', 'IVTInjection');

    res.json({
      success: true,
      data: injection
    });
  } catch (error) {
    console.error('Error fetching IVT injection:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching IVT injection',
      error: error.message
    });
  }
};

// @desc    Update IVT injection
// @route   PUT /api/ivt/:id
// @access  Private (ophthalmologist only)
exports.updateIVTInjection = async (req, res) => {
  try {
    let injection = await IVTInjection.findById(req.params.id);

    if (!injection) {
      return res.status(404).json({
        success: false,
        message: 'IVT injection not found'
      });
    }

    // Update injection
    injection = await IVTInjection.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('patient')
      .populate('performedBy', 'firstName lastName role');

    // Log the action
    await logAction(req, 'UPDATE_IVT_INJECTION', {
      injectionId: injection.injectionId,
      patientId: injection.patient._id
    });

    await logPatientDataAccess(req, injection.patient._id, 'UPDATE', 'IVTInjection');

    res.json({
      success: true,
      data: injection
    });
  } catch (error) {
    console.error('Error updating IVT injection:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating IVT injection',
      error: error.message
    });
  }
};

// @desc    Complete IVT injection
// @route   PUT /api/ivt/:id/complete
// @access  Private (ophthalmologist only)
exports.completeIVTInjection = async (req, res) => {
  try {
    const injection = await IVTInjection.findById(req.params.id);

    if (!injection) {
      return res.status(404).json({
        success: false,
        message: 'IVT injection not found'
      });
    }

    await injection.completeInjection(req.user._id);

    // Log the action
    await logCriticalOperation(req, 'COMPLETE_IVT_INJECTION', {
      injectionId: injection.injectionId,
      patientId: injection.patient,
      eye: injection.eye,
      medication: injection.medication.name
    });

    res.json({
      success: true,
      data: injection
    });
  } catch (error) {
    console.error('Error completing IVT injection:', error);
    res.status(500).json({
      success: false,
      message: 'Server error completing IVT injection',
      error: error.message
    });
  }
};

// @desc    Cancel IVT injection
// @route   PUT /api/ivt/:id/cancel
// @access  Private (ophthalmologist only)
exports.cancelIVTInjection = async (req, res) => {
  try {
    const { reason } = req.body;

    const injection = await IVTInjection.findById(req.params.id);

    if (!injection) {
      return res.status(404).json({
        success: false,
        message: 'IVT injection not found'
      });
    }

    await injection.cancelInjection(reason);

    // Log the action
    await logAction(req, 'CANCEL_IVT_INJECTION', {
      injectionId: injection.injectionId,
      patientId: injection.patient,
      reason
    });

    res.json({
      success: true,
      data: injection
    });
  } catch (error) {
    console.error('Error cancelling IVT injection:', error);
    res.status(500).json({
      success: false,
      message: 'Server error cancelling IVT injection',
      error: error.message
    });
  }
};

// @desc    Record follow-up for IVT injection
// @route   PUT /api/ivt/:id/followup
// @access  Private
exports.recordFollowUp = async (req, res) => {
  try {
    const injection = await IVTInjection.findById(req.params.id);

    if (!injection) {
      return res.status(404).json({
        success: false,
        message: 'IVT injection not found'
      });
    }

    await injection.recordFollowUp(req.body);

    // Log the action
    await logAction(req, 'RECORD_IVT_FOLLOWUP', {
      injectionId: injection.injectionId,
      patientId: injection.patient
    });

    res.json({
      success: true,
      data: injection
    });
  } catch (error) {
    console.error('Error recording follow-up:', error);
    res.status(500).json({
      success: false,
      message: 'Server error recording follow-up',
      error: error.message
    });
  }
};

// @desc    Plan next IVT injection
// @route   PUT /api/ivt/:id/plan-next
// @access  Private (ophthalmologist only)
exports.planNextInjection = async (req, res) => {
  try {
    const injection = await IVTInjection.findById(req.params.id);

    if (!injection) {
      return res.status(404).json({
        success: false,
        message: 'IVT injection not found'
      });
    }

    await injection.planNextInjection(req.body);

    // Log the action
    await logAction(req, 'PLAN_NEXT_IVT', {
      injectionId: injection.injectionId,
      patientId: injection.patient,
      recommendedDate: req.body.recommendedDate
    });

    res.json({
      success: true,
      data: injection
    });
  } catch (error) {
    console.error('Error planning next injection:', error);
    res.status(500).json({
      success: false,
      message: 'Server error planning next injection',
      error: error.message
    });
  }
};

// @desc    Get patient's IVT injection history
// @route   GET /api/ivt/patient/:patientId/history
// @access  Private
exports.getPatientIVTHistory = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { eye } = req.query;

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const injections = await IVTInjection.getPatientInjections(patientId, eye);

    // Log patient data access
    await logPatientDataAccess(req, patientId, 'READ', 'IVTInjection');

    res.json({
      success: true,
      count: injections.length,
      data: injections
    });
  } catch (error) {
    console.error('Error fetching patient IVT history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching patient IVT history',
      error: error.message
    });
  }
};

// @desc    Get treatment history with outcomes
// @route   GET /api/ivt/patient/:patientId/treatment-history
// @access  Private
exports.getTreatmentHistory = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { eye } = req.query;

    if (!eye) {
      return res.status(400).json({
        success: false,
        message: 'Eye parameter is required'
      });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const history = await IVTInjection.getTreatmentHistory(patientId, eye);

    // Log patient data access
    await logPatientDataAccess(req, patientId, 'READ', 'IVTInjection');

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching treatment history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching treatment history',
      error: error.message
    });
  }
};

// @desc    Get upcoming IVT injections
// @route   GET /api/ivt/upcoming
// @access  Private
exports.getUpcomingInjections = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const upcoming = await IVTInjection.getUpcomingInjections(parseInt(days));

    res.json({
      success: true,
      count: upcoming.length,
      data: upcoming
    });
  } catch (error) {
    console.error('Error fetching upcoming injections:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching upcoming injections',
      error: error.message
    });
  }
};

// @desc    Get patients due for injection
// @route   GET /api/ivt/due
// @access  Private
exports.getPatientsDue = async (req, res) => {
  try {
    const patientsDue = await IVTInjection.getPatientDueForInjection();

    res.json({
      success: true,
      count: patientsDue.length,
      data: patientsDue
    });
  } catch (error) {
    console.error('Error fetching patients due:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching patients due for injection',
      error: error.message
    });
  }
};

// @desc    Get IVT statistics
// @route   GET /api/ivt/stats
// @access  Private
exports.getIVTStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 3));
    const end = endDate ? new Date(endDate) : new Date();

    const stats = await IVTInjection.getStatsByIndication(start, end);

    // Get overall stats
    const totalInjections = await IVTInjection.countDocuments({
      injectionDate: { $gte: start, $lte: end },
      status: 'completed'
    });

    const complicationRate = await IVTInjection.aggregate([
      {
        $match: {
          injectionDate: { $gte: start, $lte: end },
          status: 'completed'
        }
      },
      {
        $project: {
          hasComplications: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: '$procedure.complications',
                    cond: { $ne: ['$$this.type', 'none'] }
                  }
                }
              },
              0
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          withComplications: { $sum: { $cond: ['$hasComplications', 1, 0] } }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalInjections,
        byIndication: stats,
        complicationRate: complicationRate.length > 0
          ? (complicationRate[0].withComplications / complicationRate[0].total) * 100
          : 0,
        period: { start, end }
      }
    });
  } catch (error) {
    console.error('Error fetching IVT stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching statistics',
      error: error.message
    });
  }
};

// @desc    Delete IVT injection
// @route   DELETE /api/ivt/:id
// @access  Private (admin only)
exports.deleteIVTInjection = async (req, res) => {
  try {
    const injection = await IVTInjection.findById(req.params.id);

    if (!injection) {
      return res.status(404).json({
        success: false,
        message: 'IVT injection not found'
      });
    }

    // Only allow deletion of scheduled injections
    if (injection.status !== 'scheduled' && injection.status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete completed injections'
      });
    }

    await injection.deleteOne();

    // Log the action
    await logCriticalOperation(req, 'DELETE_IVT_INJECTION', {
      injectionId: injection.injectionId,
      patientId: injection.patient
    });

    res.json({
      success: true,
      message: 'IVT injection deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting IVT injection:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting IVT injection',
      error: error.message
    });
  }
};
