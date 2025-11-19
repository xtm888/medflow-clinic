const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { logPatientDataAccess, logCriticalOperation } = require('../middleware/auditLogger');
const Visit = require('../models/Visit');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
// Required for populate to work - must register model before populating
require('../models/IVTInjection');

// @desc    Create new visit
// @route   POST /api/visits
// @access  Private
router.post('/', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse'), async (req, res) => {
  try {
    // Normalize status - convert 'in_progress' to 'in-progress' for compatibility
    let status = req.body.status;
    if (status === 'in_progress') {
      status = 'in-progress';
    }

    // Get user ID (support both _id and id)
    const userId = req.user._id || req.user.id;

    const visit = await Visit.create({
      ...req.body,
      status: status || 'in-progress',
      primaryProvider: req.body.primaryProvider || userId,
      createdBy: userId,
      updatedBy: userId
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

// @desc    Get lab orders (pending or completed)
// @route   GET /api/visits/lab-orders
// @access  Private (Medical staff and lab technicians)
router.get('/lab-orders', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse', 'lab_technician'), async (req, res) => {
  try {
    const { status, limit = 20 } = req.query;

    // Find visits with lab orders
    const query = {
      'laboratoryOrders.0': { $exists: true }
    };

    if (status === 'pending') {
      query['laboratoryOrders.status'] = { $in: ['ordered', 'in-progress', 'collected', 'processing'] };
    } else if (status === 'completed') {
      query['laboratoryOrders.status'] = 'completed';
    }

    const visits = await Visit.find(query)
      .populate('patient', 'firstName lastName patientId')
      .populate('primaryProvider', 'firstName lastName')
      .populate('laboratoryOrders.orderedBy', 'firstName lastName')
      .sort({ 'laboratoryOrders.orderedAt': -1 })
      .limit(parseInt(limit));

    // Extract lab orders from visits
    const labOrders = visits.flatMap(visit =>
      visit.laboratoryOrders.map(test => ({
        ...test.toObject(),
        visitId: visit._id,
        patient: visit.patient,
        provider: visit.primaryProvider,
        visitDate: visit.visitDate
      }))
    ).filter(order => {
      if (status === 'pending') {
        return ['ordered', 'in-progress', 'collected', 'processing'].includes(order.status);
      } else if (status === 'completed') {
        return order.status === 'completed';
      }
      return true;
    });

    res.json({
      success: true,
      count: labOrders.length,
      data: labOrders
    });
  } catch (error) {
    console.error('Error fetching lab orders:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Create lab order
// @route   POST /api/visits/lab-orders
// @access  Private
router.post('/lab-orders', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse'), async (req, res) => {
  try {
    const { visitId, patientId, orders, indication, priority } = req.body;

    // Find existing visit or create new one
    let visit;
    if (visitId) {
      visit = await Visit.findById(visitId);
    } else if (patientId) {
      // Create new visit for lab orders
      visit = await Visit.create({
        patient: patientId,
        visitDate: new Date(),
        visitType: 'procedure', // 'laboratory' is not valid enum, using 'procedure'
        primaryProvider: req.user._id, // Required field
        status: 'in-progress',
        createdBy: req.user._id,
        updatedBy: req.user._id
      });
    }

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found and no patient ID provided'
      });
    }

    // Add laboratory orders
    const newOrders = orders.map(order => ({
      template: order.templateId || order._id,
      testName: order.name || order.testName,
      testCode: order.code || order.testCode,
      category: order.category,
      specimen: order.specimen || 'Sang',
      orderedBy: req.user._id,
      orderedAt: new Date(),
      priority: priority || 'routine',
      status: 'ordered',
      notes: indication
    }));

    visit.laboratoryOrders.push(...newOrders);
    await visit.save();

    // Populate for response
    await visit.populate('patient', 'firstName lastName patientId');
    await visit.populate('laboratoryOrders.orderedBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Lab orders created successfully',
      data: {
        visitId: visit._id,
        patient: visit.patient,
        orders: visit.laboratoryOrders.slice(-newOrders.length)
      }
    });
  } catch (error) {
    console.error('Error creating lab order:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get specific lab order
// @route   GET /api/visits/lab-orders/:orderId
// @access  Private (Medical staff and lab technicians)
router.get('/lab-orders/:orderId', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse', 'lab_technician'), async (req, res) => {
  try {
    const visit = await Visit.findOne({ 'laboratoryOrders._id': req.params.orderId })
      .populate('patient', 'firstName lastName patientId phoneNumber')
      .populate('laboratoryOrders.template')
      .populate('laboratoryOrders.orderedBy', 'firstName lastName')
      .populate('laboratoryOrders.resultedBy', 'firstName lastName');

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Lab order not found'
      });
    }

    const order = visit.laboratoryOrders.id(req.params.orderId);
    res.json({
      success: true,
      data: {
        ...order.toObject(),
        patient: visit.patient,
        visitId: visit._id
      }
    });
  } catch (error) {
    console.error('Error fetching lab order:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Update lab order status
// @route   PUT /api/visits/lab-orders/:orderId/status
// @access  Private (Lab technicians and medical staff)
router.put('/lab-orders/:orderId/status', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse', 'lab_technician'), async (req, res) => {
  try {
    const { status } = req.body;
    const visit = await Visit.findOne({ 'laboratoryOrders._id': req.params.orderId });

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Lab order not found'
      });
    }

    const order = visit.laboratoryOrders.id(req.params.orderId);
    order.status = status;

    if (status === 'completed') {
      order.resultedAt = new Date();
      order.resultedBy = req.user._id;
    }

    await visit.save();

    res.json({
      success: true,
      message: 'Lab order status updated',
      data: order
    });
  } catch (error) {
    console.error('Error updating lab order status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Add results to lab order
// @route   POST /api/visits/lab-orders/:orderId/results
// @access  Private
router.post('/lab-orders/:orderId/results', protect, authorize('admin', 'doctor', 'nurse'), async (req, res) => {
  try {
    const { result, resultValue, resultUnit, normalRange, isAbnormal, notes } = req.body;
    const visit = await Visit.findOne({ 'laboratoryOrders._id': req.params.orderId });

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Lab order not found'
      });
    }

    const order = visit.laboratoryOrders.id(req.params.orderId);
    Object.assign(order, {
      result,
      resultValue,
      resultUnit,
      normalRange,
      isAbnormal,
      notes: notes || order.notes,
      status: 'completed',
      resultedAt: new Date(),
      resultedBy: req.user._id
    });

    await visit.save();

    res.json({
      success: true,
      message: 'Lab results added successfully',
      data: order
    });
  } catch (error) {
    console.error('Error adding lab results:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Cancel lab order
// @route   PUT /api/visits/lab-orders/:orderId/cancel
// @access  Private (Doctors and admin only)
router.put('/lab-orders/:orderId/cancel', protect, authorize('admin', 'doctor', 'ophthalmologist'), async (req, res) => {
  try {
    const visit = await Visit.findOne({ 'laboratoryOrders._id': req.params.orderId });

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Lab order not found'
      });
    }

    const order = visit.laboratoryOrders.id(req.params.orderId);
    order.status = 'cancelled';
    if (req.body.reason) {
      order.notes = req.body.reason;
    }

    await visit.save();

    res.json({
      success: true,
      message: 'Lab order cancelled',
      data: order
    });
  } catch (error) {
    console.error('Error cancelling lab order:', error);
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
      .populate('ivtTreatments')
      .populate('examinations.refraction')
      .populate('clinicalActs.provider', 'firstName lastName')
      .populate('billing.invoice');

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

// @desc    Complete visit with full cascade (reservations, invoice)
// @route   PUT /api/visits/:id/complete
// @access  Private (with critical operation audit logging)
router.put('/:id/complete', protect, authorize('admin', 'doctor', 'ophthalmologist'), logCriticalOperation('VISIT_COMPLETE'), async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    // Use the enhanced completeVisit method with cascade logic
    const result = await visit.completeVisit(req.user._id);

    res.json({
      success: true,
      message: 'Visit completed successfully',
      data: {
        visit: result.visit,
        reservations: result.reservations,
        invoiceGenerated: result.invoiceGenerated
      }
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
// @access  Private (with critical operation audit logging)
router.put('/:id/sign', protect, authorize('admin', 'doctor', 'ophthalmologist'), logCriticalOperation('VISIT_SIGN'), async (req, res) => {
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
// @access  Private (with critical operation audit logging)
router.put('/:id/lock', protect, authorize('admin', 'doctor', 'ophthalmologist'), logCriticalOperation('VISIT_LOCK'), async (req, res) => {
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

// @desc    Generate invoice for visit
// @route   POST /api/visits/:id/invoice
// @access  Private
router.post('/:id/invoice', protect, authorize('admin', 'doctor', 'ophthalmologist', 'receptionist'), async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    const result = await visit.generateInvoice(req.user._id);

    res.json({
      success: result.success,
      message: result.alreadyExists ? 'Invoice already exists' : 'Invoice generated successfully',
      data: {
        invoice: result.invoice,
        itemsCount: result.itemsCount,
        total: result.total
      }
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Add prescription to visit
// @route   POST /api/visits/:id/prescriptions
// @access  Private
router.post('/:id/prescriptions', protect, authorize('admin', 'doctor', 'ophthalmologist'), async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    const Prescription = require('../models/Prescription');

    // Create the prescription
    const prescription = await Prescription.create({
      ...req.body,
      visit: visit._id,
      patient: visit.patient,
      prescriber: req.user._id,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    // Link to visit
    await visit.addPrescription(prescription._id);

    res.status(201).json({
      success: true,
      data: prescription
    });
  } catch (error) {
    console.error('Error adding prescription:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get complete visit summary
// @route   GET /api/visits/:id/summary
// @access  Private
router.get('/:id/summary', protect, async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    const summary = await visit.getCompleteSummary();

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching visit summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;