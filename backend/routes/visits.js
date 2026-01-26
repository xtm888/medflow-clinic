const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { logPatientDataAccess, logCriticalOperation } = require('../middleware/auditLogger');
const { optionalClinic } = require('../middleware/clinicAuth');
const Visit = require('../models/Visit');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const { updateVisitRefraction, updateVisitDiagnosis, updateVisitTreatment } = require('../services/visitGranularService');
// Required for populate to work - must register model before populating
require('../models/IVTInjection');

// Apply clinic context middleware to all routes
router.use(protect);
router.use(optionalClinic);

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
      // Multi-clinic: Set clinic from request context (or body if specified)
      clinic: req.body.clinic || req.clinicId,
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

    // Multi-clinic: Filter by clinic unless admin with accessAllClinics
    if (req.clinicId && !req.accessAllClinics) {
      query.clinic = req.clinicId;
    }

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

// @desc    Get visit statistics
// @route   GET /api/visits/stats
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get counts by status
    const [total, completed, inProgress, scheduled, checkedIn, cancelled] = await Promise.all([
      Visit.countDocuments(),
      Visit.countDocuments({ status: 'completed' }),
      Visit.countDocuments({ status: 'in-progress' }),
      Visit.countDocuments({ status: 'scheduled' }),
      Visit.countDocuments({ status: 'checked-in' }),
      Visit.countDocuments({ status: 'cancelled' })
    ]);

    // Get today's counts
    const todayFilter = { visitDate: { $gte: today, $lt: tomorrow } };
    const [todayTotal, todayCompleted, todayInProgress] = await Promise.all([
      Visit.countDocuments(todayFilter),
      Visit.countDocuments({ ...todayFilter, status: 'completed' }),
      Visit.countDocuments({ ...todayFilter, status: 'in-progress' })
    ]);

    res.json({
      success: true,
      data: {
        total,
        completed,
        inProgress,
        scheduled,
        checkedIn,
        cancelled,
        today: {
          total: todayTotal,
          completed: todayCompleted,
          inProgress: todayInProgress
        }
      }
    });
  } catch (error) {
    console.error('Error fetching visit stats:', error);
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
    const LabOrder = require('../models/LabOrder');

    // Fetch all event types in parallel
    const [visits, prescriptions, examinations, standaloneLabOrders] = await Promise.all([
      Visit.find({ patient: patientId })
        .populate('primaryProvider', 'firstName lastName specialization')
        .sort({ visitDate: -1 }),
      Prescription.find({ patient: patientId })
        .populate('prescriber', 'firstName lastName specialization')
        .sort({ prescriptionDate: -1 }),
      OphthalmologyExam.find({ patient: patientId })
        .populate('examiner', 'firstName lastName specialization')
        .sort({ createdAt: -1 }),
      LabOrder.find({ patient: patientId })
        .populate('orderedBy', 'firstName lastName specialization')
        .sort({ orderDate: -1 })
    ]);

    // Combine visit-embedded lab orders with standalone lab orders
    const visitLabOrders = visits.flatMap(visit =>
      (visit.laboratoryOrders || []).map(lab => ({
        ...lab.toObject(),
        visitDate: visit.visitDate
      }))
    );
    const labOrders = [...visitLabOrders, ...standaloneLabOrders];

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
    // Build detailed clinical acts list (names only, limit to 5)
    const clinicalActNames = (visit.clinicalActs || [])
      .slice(0, 5)
      .map(act => act.actName || act.name)
      .filter(Boolean);

    // Build vital signs summary
    const vitalSigns = {};
    if (visit.vitalSigns) {
      const vs = visit.vitalSigns;
      if (vs.bloodPressure) vitalSigns.bloodPressure = vs.bloodPressure;
      if (vs.heartRate) vitalSigns.heartRate = vs.heartRate;
      if (vs.temperature) vitalSigns.temperature = vs.temperature;
      if (vs.weight) vitalSigns.weight = vs.weight;
      if (vs.oxygenSaturation) vitalSigns.oxygenSaturation = vs.oxygenSaturation;
    }

    // Build visual acuity summary
    const visualAcuity = visit.visualAcuity ? {
      rightEye: visit.visualAcuity.rightEye,
      leftEye: visit.visualAcuity.leftEye
    } : null;

    // Build IOP summary
    const iop = visit.intraocularPressure ? {
      rightEye: visit.intraocularPressure.rightEye,
      leftEye: visit.intraocularPressure.leftEye
    } : null;

    // Build refraction summary (simplified)
    const refraction = visit.refraction ? {
      rightEye: visit.refraction.rightEye ? {
        sphere: visit.refraction.rightEye.sphere,
        cylinder: visit.refraction.rightEye.cylinder,
        axis: visit.refraction.rightEye.axis
      } : null,
      leftEye: visit.refraction.leftEye ? {
        sphere: visit.refraction.leftEye.sphere,
        cylinder: visit.refraction.leftEye.cylinder,
        axis: visit.refraction.leftEye.axis
      } : null
    } : null;

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
        diagnoses: visit.diagnoses || [],
        clinicalActs: visit.clinicalActs?.length || 0,
        clinicalActNames: clinicalActNames,
        moreActsCount: Math.max(0, (visit.clinicalActs?.length || 0) - 5),
        vitalSigns: Object.keys(vitalSigns).length > 0 ? vitalSigns : null,
        visualAcuity: visualAcuity,
        intraocularPressure: iop,
        refraction: refraction,
        notes: visit.notes ? (typeof visit.notes === 'string' ? visit.notes.substring(0, 100) : null) : null
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

  // Add lab orders (handle both embedded and standalone formats)
  labOrders.forEach(lab => {
    // For standalone LabOrder documents
    const testNames = lab.tests?.map(t => t.testName).join(', ');
    const providerName = lab.orderedBy
      ? `${lab.orderedBy.firstName || ''} ${lab.orderedBy.lastName || ''}`.trim()
      : lab.orderedByName || 'N/A';

    events.push({
      type: 'laboratory',
      date: lab.orderDate || lab.orderedAt || lab.visitDate || lab.createdAt,
      title: `Laboratoire - ${lab.orderId || lab.testName || lab.category || 'Test'}`,
      description: testNames || lab.notes || 'Test de laboratoire',
      provider: providerName,
      status: lab.status,
      id: lab._id,
      details: {
        result: lab.result,
        isAbnormal: lab.isAbnormal,
        testsCount: lab.tests?.length || 1
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

    // Fetch related data from separate collections (not just embedded arrays)
    const Prescription = require('../models/Prescription');
    const LabOrder = require('../models/LabOrder');
    const OphthalmologyExam = require('../models/OphthalmologyExam');

    const [prescriptions, labOrders, ophthalmologyExams] = await Promise.all([
      Prescription.find({ visit: visit._id })
        .populate('prescriber', 'firstName lastName')
        .sort({ prescriptionDate: -1 }),
      LabOrder.find({ visit: visit._id })
        .populate('orderedBy', 'firstName lastName')
        .sort({ orderDate: -1 }),
      OphthalmologyExam.find({ visit: visit._id })
        .populate('examiner', 'firstName lastName')
        .sort({ createdAt: -1 })
    ]);

    // Build enhanced visit response with related data
    const visitData = visit.toObject();

    // Merge prescriptions - prioritize collection data over embedded
    if (prescriptions.length > 0) {
      visitData.prescriptions = prescriptions;
    }

    // Merge lab orders - prioritize collection data over embedded
    if (labOrders.length > 0) {
      visitData.labOrders = labOrders;
    }

    // Add ophthalmology exams if any
    if (ophthalmologyExams.length > 0) {
      visitData.ophthalmologyExams = ophthalmologyExams;
    }

    res.json({
      success: true,
      data: visitData
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
router.put('/:id', protect, authorize('admin', 'doctor', 'ophthalmologist', 'nurse'), logCriticalOperation('VISIT_UPDATE'), async (req, res) => {
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

// @desc    Update visit refraction data (granular update)
// @route   PUT /api/visits/:id/refraction
// @access  Private
router.put('/:id/refraction', protect, authorize('admin', 'doctor', 'ophthalmologist'), logCriticalOperation('VISIT_REFRACTION_UPDATE'), async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const result = await updateVisitRefraction(req.params.id, req.body, userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    // Handle service-level validation errors
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Update visit diagnosis data (granular update)
// @route   PUT /api/visits/:id/diagnosis
// @access  Private
router.put('/:id/diagnosis', protect, authorize('admin', 'doctor', 'ophthalmologist'), logCriticalOperation('VISIT_DIAGNOSIS_UPDATE'), async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const result = await updateVisitDiagnosis(req.params.id, req.body.diagnoses || req.body, userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    // Handle service-level validation errors
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Update visit treatment/plan data (granular update)
// @route   PUT /api/visits/:id/treatment
// @access  Private
router.put('/:id/treatment', protect, authorize('admin', 'doctor', 'ophthalmologist'), logCriticalOperation('VISIT_TREATMENT_UPDATE'), async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const result = await updateVisitTreatment(req.params.id, req.body, userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    // Handle service-level validation errors
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
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

    // Sign the visit
    await visit.signVisit(req.user._id);

    // CRITICAL FIX: Also complete the visit if it's in-progress
    // Signing a visit means the doctor approves and the consultation is done
    let completionResult = null;
    if (visit.status === 'in-progress') {
      try {
        completionResult = await visit.completeVisit(req.user._id);
        console.log(`[VISIT SIGN] Visit ${visit.visitId} signed AND completed`);
      } catch (completeError) {
        console.error(`[VISIT SIGN] Failed to complete visit ${visit.visitId}:`, completeError.message);
        // Don't fail the sign operation if completion fails - visit is still signed
      }
    }

    res.json({
      success: true,
      data: visit,
      completed: !!completionResult,
      invoiceGenerated: completionResult?.invoiceGenerated || false
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

// @desc    Get visit billing information
// @route   GET /api/visits/:id/billing
// @access  Private
router.get('/:id/billing', protect, async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id)
      .populate('patient', 'firstName lastName patientId insurance')
      .populate('billing.invoice');

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    // Calculate total from clinical acts
    const clinicalActsTotal = (visit.clinicalActs || []).reduce((sum, act) => {
      return sum + (act.price || act.fee || 0);
    }, 0);

    // Get prescription costs if any
    const Prescription = require('../models/Prescription');
    const prescriptions = await Prescription.find({ visit: visit._id });
    const prescriptionTotal = prescriptions.reduce((sum, rx) => {
      return sum + (rx.medications || []).reduce((medSum, med) => {
        return medSum + (med.price || 0) * (med.quantity || 1);
      }, 0);
    }, 0);

    const billingData = {
      visitId: visit._id,
      patient: visit.patient,
      visitDate: visit.visitDate,
      visitType: visit.visitType,
      clinicalActs: visit.clinicalActs || [],
      clinicalActsTotal,
      prescriptionTotal,
      totalAmount: clinicalActsTotal + prescriptionTotal,
      invoice: visit.billing?.invoice || null,
      invoiceStatus: visit.billing?.invoiceStatus || 'not_generated',
      paymentStatus: visit.billing?.paymentStatus || 'unpaid',
      insurance: visit.patient?.insurance || null
    };

    res.json({
      success: true,
      data: billingData
    });
  } catch (error) {
    console.error('Error fetching visit billing:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Calculate copay for visit
// @route   GET /api/visits/:id/calculate-copay
// @access  Private
router.get('/:id/calculate-copay', protect, async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id)
      .populate('patient', 'firstName lastName insurance');

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    const patientInsurance = visit.patient?.insurance;

    // Calculate base visit cost
    const visitCost = (visit.clinicalActs || []).reduce((sum, act) => {
      return sum + (act.price || act.fee || 0);
    }, 0);

    let copayData = {
      visitId: visit._id,
      visitType: visit.visitType,
      baseCost: visitCost,
      hasInsurance: false,
      copayAmount: visitCost, // Default to full cost if no insurance
      insuranceCoverage: 0,
      patientResponsibility: visitCost
    };

    if (patientInsurance && patientInsurance.provider) {
      // Simulate copay calculation based on insurance
      const coveragePercentage = patientInsurance.coveragePercentage || 80;
      const copay = patientInsurance.copay || 25;
      const deductibleMet = patientInsurance.deductibleMet !== false;

      if (deductibleMet) {
        const insurancePays = (visitCost * coveragePercentage) / 100;
        copayData = {
          ...copayData,
          hasInsurance: true,
          insuranceProvider: patientInsurance.provider,
          policyNumber: patientInsurance.policyNumber,
          coveragePercentage,
          copayAmount: copay,
          insuranceCoverage: insurancePays,
          patientResponsibility: Math.max(visitCost - insurancePays, copay),
          deductibleMet
        };
      } else {
        // Deductible not met - patient pays full amount
        copayData = {
          ...copayData,
          hasInsurance: true,
          insuranceProvider: patientInsurance.provider,
          coveragePercentage: 0,
          copayAmount: visitCost,
          insuranceCoverage: 0,
          patientResponsibility: visitCost,
          deductibleMet: false,
          note: 'Deductible not yet met'
        };
      }
    }

    res.json({
      success: true,
      data: copayData
    });
  } catch (error) {
    console.error('Error calculating copay:', error);
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

// @desc    Generate Fiche d'Ophtalmologie PDF
// @route   GET /api/visits/:id/fiche-pdf
// @access  Private
router.get('/:id/fiche-pdf', protect, logPatientDataAccess, async (req, res) => {
  try {
    const pdfGenerator = require('../services/pdfGenerator');
    const Prescription = require('../models/Prescription');
    const User = require('../models/User');

    // Fetch visit with all related data
    const visit = await Visit.findById(req.params.id)
      .populate('patient')
      .populate('primaryProvider', 'firstName lastName title specialization');

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    // Fetch prescriptions for this visit
    const prescriptions = await Prescription.find({ visit: visit._id })
      .populate('prescriber', 'firstName lastName title')
      .sort({ prescriptionDate: -1 });

    // Flatten medications from all prescriptions
    const allMedications = prescriptions.flatMap(rx =>
      (rx.medications || []).map(med => ({
        medication: med.drug?.name || med.medication || med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        duration: med.duration,
        applicationLocation: med.applicationLocation,
        renew: med.renewInstruction || (med.refillsAllowed > 0 ? 'A RENOUVELER' : ''),
        instruction: med.instructions
      }))
    );

    // Prepare data for PDF generation
    const pdfData = {
      patient: visit.patient,
      visit: {
        visitId: visit.visitId,
        visitNumber: visit.visitNumber,
        createdAt: visit.visitDate || visit.createdAt,
        date: visit.visitDate,
        time: visit.visitTime,
        chiefComplaint: visit.chiefComplaint?.complaint || visit.chiefComplaint,
        complaint: visit.chiefComplaint,
        reason: visit.reason,
        diagnosis: visit.diagnoses?.[0]?.diagnosis?.name || visit.diagnoses?.[0]?.name ||
                   visit.assessment?.primaryDiagnosis || visit.notes,
        provider: visit.primaryProvider,
        followUp: visit.followUp,
        warning: visit.treatmentWarning || ''
      },
      prescriptions: allMedications,
      provider: visit.primaryProvider,
      documentNumber: `${visit.patient?.patientId || ''}${visit.visitNumber ? '/' + visit.visitNumber : ''}`,
      warning: req.query.warning || 'NE JAMAIS ARRETER LE TRAITEMENT SANS AVIS MEDICAL',
      nextAppointment: req.query.nextAppointment || visit.followUp?.instructions || '',
      diagnosis: visit.diagnoses?.[0]?.diagnosis?.name || visit.diagnoses?.[0]?.name || ''
    };

    // Generate PDF
    const pdfBuffer = await pdfGenerator.generateFicheOphtalmologiePDF(pdfData);

    // Set response headers for PDF download
    const filename = `fiche-ophta-${visit.patient?.patientId || 'patient'}-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating Fiche PDF:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
