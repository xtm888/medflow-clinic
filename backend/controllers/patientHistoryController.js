const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const Prescription = require('../models/Prescription');
const OphthalmologyExam = require('../models/OphthalmologyExam');
const Appointment = require('../models/Appointment');
const AuditLog = require('../models/AuditLog');

/**
 * Get complete patient profile with all history
 * GET /api/patients/:id/complete-profile
 */
exports.getCompleteProfile = async (req, res) => {
  try {
    const patientId = req.params.id;

    // Parallel fetch all related data for performance
    const [patient, visits, prescriptions, examinations, appointments, auditLogs] = await Promise.all([
      // Patient with full details
      Patient.findById(patientId)
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName'),

      // All visits with providers
      Visit.find({ patient: patientId })
        .populate('primaryProvider', 'firstName lastName specialization')
        .populate('additionalProviders', 'firstName lastName')
        .populate('prescriptions')
        .sort({ visitDate: -1 })
        .limit(50),

      // All prescriptions
      Prescription.find({ patient: patientId })
        .populate('prescriber', 'firstName lastName specialization')
        .populate('medications.drug', 'name form strength')
        .sort({ prescriptionDate: -1 }),

      // All ophthalmology exams
      OphthalmologyExam.find({ patient: patientId })
        .populate('examiner', 'firstName lastName specialization')
        .sort({ createdAt: -1 }),

      // All appointments
      Appointment.find({ patient: patientId })
        .populate('provider', 'firstName lastName')
        .sort({ date: -1 })
        .limit(20),

      // Recent audit logs for this patient
      AuditLog.find({
        $or: [
          { resourceId: patientId },
          { 'data.patientId': patientId }
        ]
      })
        .populate('user', 'firstName lastName role')
        .sort({ timestamp: -1 })
        .limit(50)
    ]);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // Extract lab orders from visits
    const labOrders = visits.flatMap(visit =>
      (visit.laboratoryOrders || []).map(lab => ({
        ...lab.toObject(),
        visitId: visit._id,
        visitDate: visit.visitDate,
        orderedByName: visit.primaryProvider?.firstName + ' ' + visit.primaryProvider?.lastName
      }))
    );

    // Extract imaging studies from visits
    const imagingStudies = visits.flatMap(visit =>
      (visit.examinationOrders || []).filter(exam =>
        ['imaging', 'xray', 'ultrasound', 'oct', 'mri', 'ct'].includes(exam.category?.toLowerCase())
      ).map(img => ({
        ...img.toObject(),
        visitId: visit._id,
        visitDate: visit.visitDate
      }))
    );

    // Build timeline of all events
    const timeline = buildPatientTimeline(visits, prescriptions, examinations, labOrders);

    // Categorize prescriptions
    const activePrescriptions = prescriptions.filter(p =>
      p.status === 'active' || p.status === 'ready' || p.status === 'dispensed'
    );
    const pastPrescriptions = prescriptions.filter(p =>
      p.status === 'expired' || p.status === 'completed' || p.status === 'cancelled'
    );

    // Get all providers who have treated this patient
    const providers = getUniqueProviders(visits, prescriptions, examinations);

    res.json({
      success: true,
      data: {
        patient,
        medicalHistory: {
          allergies: patient.medicalHistory?.allergies || [],
          chronicConditions: patient.medicalHistory?.chronicConditions || [],
          surgeries: patient.medicalHistory?.surgeries || [],
          familyHistory: patient.medicalHistory?.familyHistory || []
        },
        currentMedications: patient.currentMedications || [],
        vitalSigns: patient.vitalSigns,
        riskFactors: patient.riskFactors,
        visits: {
          total: visits.length,
          recent: visits.slice(0, 10)
        },
        prescriptions: {
          active: activePrescriptions,
          past: pastPrescriptions,
          total: prescriptions.length
        },
        examinations: {
          ophthalmology: examinations,
          total: examinations.length
        },
        laboratory: {
          orders: labOrders,
          pending: labOrders.filter(l => l.status === 'ordered' || l.status === 'processing'),
          completed: labOrders.filter(l => l.status === 'completed')
        },
        imaging: imagingStudies,
        appointments: {
          upcoming: appointments.filter(a => new Date(a.date) >= new Date()),
          past: appointments.filter(a => new Date(a.date) < new Date())
        },
        providers,
        timeline,
        auditTrail: auditLogs
      }
    });
  } catch (error) {
    console.error('Error fetching complete patient profile:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// NOTE: getTimeline was moved to /api/visits/timeline/:patientId (visits.js)
// The comprehensive timeline implementation is now in the visits route

/**
 * Get patient's medical issues (conditions)
 * GET /api/patients/:id/medical-issues
 */
exports.getMedicalIssues = async (req, res) => {
  try {
    const patientId = req.params.id;
    const { status } = req.query;

    const patient = await Patient.findById(patientId)
      .select('medicalHistory.chronicConditions medicalHistory.allergies');

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    let conditions = patient.medicalHistory?.chronicConditions || [];

    // Filter by status if specified
    if (status) {
      conditions = conditions.filter(c => c.status === status);
    }

    // Get exam-discovered issues
    const examinations = await OphthalmologyExam.find({ patient: patientId })
      .select('assessment.diagnoses createdAt examiner')
      .populate('examiner', 'firstName lastName');

    const examDiagnoses = examinations.flatMap(exam =>
      (exam.assessment?.diagnoses || []).map(d => ({
        condition: d.diagnosis,
        icdCode: d.icdCode,
        status: d.status || 'active',
        severity: d.severity,
        diagnosedDate: exam.createdAt,
        diagnosedBy: exam.examiner,
        source: 'examination',
        examId: exam._id
      }))
    );

    res.json({
      success: true,
      data: {
        chronicConditions: conditions,
        examDiagnoses,
        allergies: patient.medicalHistory?.allergies || []
      }
    });
  } catch (error) {
    console.error('Error fetching medical issues:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Update medical issue status
 * PUT /api/patients/:id/medical-issues/:issueId
 */
exports.updateMedicalIssue = async (req, res) => {
  try {
    const { id: patientId, issueId } = req.params;
    const { status, notes } = req.body;

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    const condition = patient.medicalHistory.chronicConditions.id(issueId);
    if (!condition) {
      return res.status(404).json({
        success: false,
        error: 'Medical issue not found'
      });
    }

    if (status) condition.status = status;
    if (notes) condition.notes = notes;
    condition.lastUpdated = new Date();
    condition.updatedBy = req.user._id;

    await patient.save();

    res.json({
      success: true,
      message: 'Medical issue updated',
      data: condition
    });
  } catch (error) {
    console.error('Error updating medical issue:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get all providers who treated this patient
 * GET /api/patients/:id/providers
 */
exports.getProviders = async (req, res) => {
  try {
    const patientId = req.params.id;

    const [visits, prescriptions, examinations] = await Promise.all([
      Visit.find({ patient: patientId })
        .populate('primaryProvider', 'firstName lastName specialization email')
        .populate('additionalProviders', 'firstName lastName specialization'),
      Prescription.find({ patient: patientId })
        .populate('prescriber', 'firstName lastName specialization email'),
      OphthalmologyExam.find({ patient: patientId })
        .populate('examiner', 'firstName lastName specialization email')
    ]);

    const providers = getUniqueProviders(visits, prescriptions, examinations);

    res.json({
      success: true,
      data: providers
    });
  } catch (error) {
    console.error('Error fetching patient providers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get patient audit trail
 * GET /api/patients/:id/audit
 */
exports.getAuditTrail = async (req, res) => {
  try {
    const patientId = req.params.id;
    const { limit = 100, action } = req.query;

    const query = {
      $or: [
        { resourceId: patientId },
        { 'data.patientId': patientId }
      ]
    };

    if (action) {
      query.action = action;
    }

    const auditLogs = await AuditLog.find(query)
      .populate('user', 'firstName lastName role')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: auditLogs.length,
      data: auditLogs
    });
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Helper function to build patient timeline
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

// Helper function to get unique providers
function getUniqueProviders(visits, prescriptions, examinations) {
  const providerMap = new Map();

  // From visits
  visits.forEach(visit => {
    if (visit.primaryProvider) {
      const key = visit.primaryProvider._id.toString();
      if (!providerMap.has(key)) {
        providerMap.set(key, {
          ...visit.primaryProvider.toObject(),
          interactions: 0,
          lastSeen: null,
          types: new Set()
        });
      }
      const p = providerMap.get(key);
      p.interactions++;
      p.types.add('visit');
      if (!p.lastSeen || new Date(visit.visitDate) > new Date(p.lastSeen)) {
        p.lastSeen = visit.visitDate;
      }
    }
  });

  // From prescriptions
  prescriptions.forEach(rx => {
    if (rx.prescriber) {
      const key = rx.prescriber._id.toString();
      if (!providerMap.has(key)) {
        providerMap.set(key, {
          ...rx.prescriber.toObject(),
          interactions: 0,
          lastSeen: null,
          types: new Set()
        });
      }
      const p = providerMap.get(key);
      p.interactions++;
      p.types.add('prescription');
      if (!p.lastSeen || new Date(rx.prescriptionDate) > new Date(p.lastSeen)) {
        p.lastSeen = rx.prescriptionDate;
      }
    }
  });

  // From examinations
  examinations.forEach(exam => {
    if (exam.examiner) {
      const key = exam.examiner._id.toString();
      if (!providerMap.has(key)) {
        providerMap.set(key, {
          ...exam.examiner.toObject(),
          interactions: 0,
          lastSeen: null,
          types: new Set()
        });
      }
      const p = providerMap.get(key);
      p.interactions++;
      p.types.add('examination');
      if (!p.lastSeen || new Date(exam.createdAt) > new Date(p.lastSeen)) {
        p.lastSeen = exam.createdAt;
      }
    }
  });

  // Convert to array and format
  return Array.from(providerMap.values()).map(p => ({
    ...p,
    types: Array.from(p.types)
  })).sort((a, b) => b.interactions - a.interactions);
}
