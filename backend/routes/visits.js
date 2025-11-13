const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Visit = require('../models/Visit');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');

// @desc    Create new visit
// @route   POST /api/visits
// @access  Private
router.post('/', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse'), async (req, res) => {
  try {
    const visit = await Visit.create({
      ...req.body,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    // Update appointment if linked
    if (req.body.appointment) {
      await Appointment.findByIdAndUpdate(req.body.appointment, {
        status: 'checked-in',
        checkInTime: new Date()
      });
    }

    // Update patient's last visit
    await Patient.findByIdAndUpdate(req.body.patient, {
      lastVisit: visit.visitDate
    });

    const populatedVisit = await Visit.findById(visit._id)
      .populate('patient', 'firstName lastName patientId')
      .populate('primaryProvider', 'firstName lastName');

    res.status(201).json({
      success: true,
      data: populatedVisit
    });
  } catch (error) {
    console.error('Error creating visit:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get visit by ID
// @route   GET /api/visits/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id)
      .populate('patient')
      .populate('primaryProvider', 'firstName lastName specialization')
      .populate('additionalProviders', 'firstName lastName specialization')
      .populate('appointment')
      .populate('prescriptions')
      .populate('examinations.refraction')
      .populate('clinicalActs.provider', 'firstName lastName');

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    res.json({
      success: true,
      data: visit
    });
  } catch (error) {
    console.error('Error fetching visit:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Update visit
// @route   PUT /api/visits/:id
// @access  Private
router.put('/:id', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse'), async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    // Check if visit is locked
    if (visit.signatureStatus === 'locked') {
      return res.status(403).json({
        success: false,
        error: 'Visit is locked and cannot be modified'
      });
    }

    // Update visit
    Object.assign(visit, req.body);
    visit.updatedBy = req.user._id;
    await visit.save();

    const updatedVisit = await Visit.findById(visit._id)
      .populate('patient', 'firstName lastName patientId')
      .populate('primaryProvider', 'firstName lastName');

    res.json({
      success: true,
      data: updatedVisit
    });
  } catch (error) {
    console.error('Error updating visit:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get patient's visit history/timeline
// @route   GET /api/visits/patient/:patientId
// @access  Private
router.get('/patient/:patientId', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type } = req.query;

    const query = { patient: req.params.patientId };
    if (status) query.status = status;
    if (type) query.visitType = type;

    const visits = await Visit.find(query)
      .sort({ visitDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('primaryProvider', 'firstName lastName')
      .populate('appointment', 'type')
      .select('visitId visitDate visitType status diagnoses chiefComplaint primaryProvider');

    const count = await Visit.countDocuments(query);

    res.json({
      success: true,
      data: visits,
      pagination: {
        total: count,
        pages: Math.ceil(count / limit),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching visit history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Add clinical act to visit
// @route   POST /api/visits/:id/acts
// @access  Private
router.post('/:id/acts', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse'), async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    const clinicalAct = {
      ...req.body,
      provider: req.user._id,
      startTime: new Date()
    };

    visit.clinicalActs.push(clinicalAct);
    await visit.save();

    res.json({
      success: true,
      data: visit.clinicalActs[visit.clinicalActs.length - 1]
    });
  } catch (error) {
    console.error('Error adding clinical act:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Update clinical act status
// @route   PUT /api/visits/:id/acts/:actId
// @access  Private
router.put('/:id/acts/:actId', protect, async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    const act = visit.clinicalActs.id(req.params.actId);
    if (!act) {
      return res.status(404).json({
        success: false,
        error: 'Clinical act not found'
      });
    }

    // Update act
    Object.assign(act, req.body);
    if (req.body.status === 'completed') {
      act.endTime = new Date();
    }

    await visit.save();

    res.json({
      success: true,
      data: act
    });
  } catch (error) {
    console.error('Error updating clinical act:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Complete visit
// @route   PUT /api/visits/:id/complete
// @access  Private
router.put('/:id/complete', protect, authorize('admin', 'doctor', 'ophthalmologist'), async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    await visit.completeVisit(req.user._id);

    // Update appointment if linked
    if (visit.appointment) {
      await Appointment.findByIdAndUpdate(visit.appointment, {
        status: 'completed',
        consultationEndTime: new Date()
      });
    }

    res.json({
      success: true,
      data: visit
    });
  } catch (error) {
    console.error('Error completing visit:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Sign visit
// @route   PUT /api/visits/:id/sign
// @access  Private
router.put('/:id/sign', protect, authorize('admin', 'doctor', 'ophthalmologist'), async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    // Verify user is the primary provider or has permission
    if (visit.primaryProvider.toString() !== req.user._id.toString() &&
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only the primary provider can sign this visit'
      });
    }

    await visit.signVisit(req.user._id);

    res.json({
      success: true,
      data: visit
    });
  } catch (error) {
    console.error('Error signing visit:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Lock visit (no further edits)
// @route   PUT /api/visits/:id/lock
// @access  Private
router.put('/:id/lock', protect, authorize('admin', 'doctor', 'ophthalmologist'), async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    // Verify visit is signed before locking
    if (!visit.signedBy) {
      return res.status(400).json({
        success: false,
        error: 'Visit must be signed before locking'
      });
    }

    await visit.lockVisit();

    res.json({
      success: true,
      data: visit
    });
  } catch (error) {
    console.error('Error locking visit:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get visit timeline for patient
// @route   GET /api/visits/timeline/:patientId
// @access  Private
router.get('/timeline/:patientId', protect, async (req, res) => {
  try {
    const timeline = await Visit.getTimeline(req.params.patientId, req.query.limit);

    res.json({
      success: true,
      data: timeline
    });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Add document to visit
// @route   POST /api/visits/:id/documents
// @access  Private
router.post('/:id/documents', protect, async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    const document = {
      ...req.body,
      uploadedBy: req.user._id,
      uploadedAt: new Date()
    };

    visit.documents.push(document);
    await visit.save();

    res.json({
      success: true,
      data: visit.documents[visit.documents.length - 1]
    });
  } catch (error) {
    console.error('Error adding document:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get today's visits
// @route   GET /api/visits/today
// @access  Private
router.get('/today', protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const query = {
      visitDate: {
        $gte: today,
        $lt: tomorrow
      }
    };

    // Filter by provider if specified
    if (req.query.provider) {
      query.primaryProvider = req.query.provider;
    }

    const visits = await Visit.find(query)
      .populate('patient', 'firstName lastName patientId phoneNumber')
      .populate('primaryProvider', 'firstName lastName')
      .populate('appointment', 'startTime endTime')
      .sort({ visitDate: 1 });

    res.json({
      success: true,
      data: visits
    });
  } catch (error) {
    console.error('Error fetching today visits:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;