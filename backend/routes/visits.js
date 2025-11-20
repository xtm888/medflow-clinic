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

// @desc    Get comprehensive patient timeline (visits, prescriptions, exams, labs)
// @route   GET /api/visits/timeline/:patientId
// @access  Private
// NOTE: Consolidated from patientHistory - includes all event types, not just visits
router.get('/timeline/:patientId', protect, async (req, res) => {
  try {
    const paramId = req.params.patientId;
    const { limit = 50, offset = 0, type } = req.query;

    // Resolve patient ID - could be ObjectId or patientId string (e.g., PAT2025000001)
    let patient;
    const mongoose = require('mongoose');
    if (mongoose.Types.ObjectId.isValid(paramId)) {
      patient = await Patient.findById(paramId);
    }
    if (!patient) {
      patient = await Patient.findOne({ patientId: paramId });
    }
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    const patientId = patient._id;
    const Prescription = require('../models/Prescription');
    const OphthalmologyExam = require('../models/OphthalmologyExam');

    // Fetch all event types in parallel
    const [visits, prescriptions, examinations] = await Promise.all([
      Visit.find({ patient: patientId })
        .populate('primaryProvider', 'firstName lastName specialization')
        .sort({ visitDate: -1 }),
      Prescription.find({ patient: patientId })
        .populate('prescriber', 'firstName lastName specialization')
        .sort({ prescriptionDate: -1 }),
      OphthalmologyExam.find({ patient: patientId })
        .populate('examiner', 'firstName lastName specialization')
        .sort({ createdAt: -1 })
    ]);

    // Extract lab orders from visits
    const labOrders = visits.flatMap(visit =>
      (visit.laboratoryOrders || []).map(lab => ({
        ...lab.toObject(),
        visitDate: visit.visitDate
      }))
    );

    // Build comprehensive timeline
    let timeline = buildPatientTimeline(visits, prescriptions, examinations, labOrders);

    // Filter by type if specified
    if (type) {
      timeline = timeline.filter(event => event.type === type);
    }

    // Paginate
    const paginatedTimeline = timeline.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      data: paginatedTimeline,
      pagination: {
        total: timeline.length,
        offset: parseInt(offset),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to build comprehensive patient timeline
function buildPatientTimeline(visits, prescriptions, examinations, labOrders) {
  const events = [];

  // Add visits
  visits.forEach(visit => {
    events.push({
      type: 'visit',
      date: visit.visitDate,
      title: `Visite - ${visit.visitType || 'Consultation'}`,
      description: visit.chiefComplaint?.complaint || 'Visite médicale',
      provider: visit.primaryProvider ?
        `${visit.primaryProvider.firstName} ${visit.primaryProvider.lastName}` : 'N/A',
      providerSpecialty: visit.primaryProvider?.specialization,
      status: visit.status,
      id: visit._id,
      details: {
        diagnoses: visit.diagnoses,
        clinicalActs: visit.clinicalActs?.length || 0
      }
    });
  });

  // Add prescriptions
  prescriptions.forEach(rx => {
    const medNames = rx.medications?.map(m => m.drug?.name || m.name).filter(Boolean).join(', ');
    events.push({
      type: 'prescription',
      date: rx.prescriptionDate,
      title: `Ordonnance - ${rx.prescriptionType || 'Médicaments'}`,
      description: medNames || rx.diagnosis || 'Prescription',
      provider: rx.prescriber ?
        `${rx.prescriber.firstName} ${rx.prescriber.lastName}` : 'N/A',
      providerSpecialty: rx.prescriber?.specialization,
      status: rx.status,
      id: rx._id,
      details: {
        medicationCount: rx.medications?.length || 0,
        validUntil: rx.validUntil
      }
    });
  });

  // Add examinations
  examinations.forEach(exam => {
    events.push({
      type: 'examination',
      date: exam.createdAt,
      title: `Examen - ${exam.examType || 'Ophtalmologie'}`,
      description: exam.assessment?.summary || 'Examen ophtalmologique',
      provider: exam.examiner ?
        `${exam.examiner.firstName} ${exam.examiner.lastName}` : 'N/A',
      providerSpecialty: exam.examiner?.specialization || 'Ophtalmologie',
      status: exam.status || 'completed',
      id: exam._id,
      details: {
        diagnoses: exam.assessment?.diagnoses,
        visualAcuity: exam.visualAcuity
      }
    });
  });

  // Add lab orders
  labOrders.forEach(lab => {
    events.push({
      type: 'laboratory',
      date: lab.orderedAt || lab.visitDate,
      title: `Laboratoire - ${lab.testName || lab.category}`,
      description: lab.notes || 'Test de laboratoire',
      provider: lab.orderedByName || 'N/A',
      status: lab.status,
      id: lab._id,
      details: {
        result: lab.result,
        isAbnormal: lab.isAbnormal
      }
    });
  });

  // Sort by date descending
  events.sort((a, b) => new Date(b.date) - new Date(a.date));

  return events;
}

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

// NOTE: Prescription creation moved to /api/prescriptions endpoint
// Use POST /api/prescriptions with visitId in body instead

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