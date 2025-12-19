const mongoose = require('mongoose');
const Counter = require('./Counter');

/**
 * ConsultationSession Model
 * Stores consultation data with auto-save functionality
 * Supports refraction, contact lens, and orthoptic tabs
 */

// Refraction data schema
const refractionDataSchema = new mongoose.Schema({
  eye: {
    type: String,
    // OD=Right eye, OS/OG=Left eye (supporting both standards)
    enum: ['OD', 'OS', 'OG'],
    required: true
  },
  sphere: Number,
  cylinder: Number,
  axis: Number,
  addition: Number,
  visualAcuity: String,
  notes: String
}, { _id: false });

// Contact lens data schema
const contactLensDataSchema = new mongoose.Schema({
  eye: {
    type: String,
    // OD=Right eye, OS/OG=Left eye (supporting both standards)
    enum: ['OD', 'OS', 'OG'],
    required: true
  },
  brand: String,
  type: {
    type: String,
    enum: ['soft', 'rigid', 'hybrid', 'scleral']
  },
  baseCurve: Number,
  diameter: Number,
  power: Number,
  cylinder: Number,
  axis: Number,
  addition: Number,
  color: String,
  replacementSchedule: String,
  trialResult: String,
  notes: String
}, { _id: false });

// Orthoptic exam data schema
const orthopticDataSchema = new mongoose.Schema({
  // Visual acuity
  visualAcuity: {
    farOD: String,
    farOG: String,
    farBinocular: String,
    nearOD: String,
    nearOG: String,
    nearBinocular: String
  },

  // Ocular motility
  ocularMotility: {
    versions: String,
    ductions: String,
    nystagmus: String,
    notes: String
  },

  // Cover test
  coverTest: {
    farWithCorrection: String,
    farWithoutCorrection: String,
    nearWithCorrection: String,
    nearWithoutCorrection: String
  },

  // Convergence
  convergence: {
    nearPointOfConvergence: String,
    fusionalReserves: String,
    accommodativeAmplitude: String
  },

  // Binocular vision tests
  binocularVision: {
    worthTest: String,
    stereoTest: String,
    stereoacuity: String,
    bagoliniTest: String
  },

  // Measurements
  measurements: {
    interpupillaryDistance: Number,
    pupilSizeOD: Number,
    pupilSizeOG: Number,
    dominantEye: {
      type: String,
      // OD=Right eye, OS/OG=Left eye
      enum: ['OD', 'OS', 'OG']
    }
  },

  // Additional findings
  diagnosis: String,
  treatment: String,
  exercises: String,
  followUp: String,
  notes: String
}, { _id: false });

const consultationSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    unique: true,
    sparse: true
  },

  // Multi-Clinic: Which clinic this consultation session is happening at
  // Patient may be registered at Clinic A but consulting at Clinic B
  clinic: {
    type: mongoose.Schema.ObjectId,
    ref: 'Clinic',
    required: true,
    index: true
  },

  patient: {
    type: mongoose.Schema.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },

  visit: {
    type: mongoose.Schema.ObjectId,
    ref: 'Visit'
  },

  appointment: {
    type: mongoose.Schema.ObjectId,
    ref: 'Appointment'
  },

  doctor: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },

  // Session metadata
  sessionDate: {
    type: Date,
    default: Date.now,
    index: true
  },

  sessionType: {
    type: String,
    enum: ['refraction', 'contact_lens', 'orthoptic', 'comprehensive'],
    default: 'comprehensive'
  },

  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned'],
    default: 'active',
    index: true
  },

  // Tab data
  refractionData: {
    OD: refractionDataSchema,
    OG: refractionDataSchema,
    prescription: String,
    notes: String
  },

  contactLensData: {
    OD: contactLensDataSchema,
    OG: contactLensDataSchema,
    prescription: String,
    trialDate: Date,
    followUpDate: Date,
    notes: String
  },

  orthopticData: orthopticDataSchema,

  // Dashboard mode - flexible data storage for comprehensive consultations
  sessionData: mongoose.Schema.Types.Mixed,
  diagnostic: mongoose.Schema.Types.Mixed,
  laboratory: mongoose.Schema.Types.Mixed,
  prescription: mongoose.Schema.Types.Mixed,
  stepData: mongoose.Schema.Types.Mixed, // For step-based workflow data

  // Auto-save tracking
  lastAutoSave: Date,
  autoSaveCount: {
    type: Number,
    default: 0
  },

  // Manual save tracking
  lastManualSave: Date,
  lastSavedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },

  // Version control for conflict resolution
  version: {
    type: Number,
    default: 1
  },

  // Completion tracking
  completedAt: Date,
  completedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },

  // Additional metadata
  activeTab: {
    type: String,
    enum: ['refraction', 'contact_lens', 'orthoptic'],
    default: 'refraction'
  },

  duration: Number, // in seconds

  notes: String

}, {
  timestamps: true
});

// Indexes
consultationSessionSchema.index({ clinic: 1, patient: 1, sessionDate: -1 });
consultationSessionSchema.index({ clinic: 1, doctor: 1, status: 1 });
consultationSessionSchema.index({ clinic: 1, createdAt: -1 });
// Index for cross-clinic patient lookup (all consultations regardless of clinic)
consultationSessionSchema.index({ patient: 1, sessionDate: -1 });

// Generate session ID
consultationSessionSchema.pre('save', async function(next) {
  if (!this.sessionId) {
    const counterId = Counter.getDailyCounterId('consultation');
    const sequence = await Counter.getNextSequence(counterId);
    // Use local date to match Counter.getDailyCounterId (fixes timezone mismatch)
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    this.sessionId = `CONS-${dateStr}-${String(sequence).padStart(4, '0')}`;
  }
  next();
});

// Static method to get active session for patient (by specific doctor at specific clinic)
consultationSessionSchema.statics.getActiveSession = async function(patientId, doctorId, clinicId = null) {
  const query = {
    patient: patientId,
    doctor: doctorId,
    status: 'active'
  };

  // MULTI-CLINIC: Optionally filter by clinic
  if (clinicId) query.clinic = clinicId;

  return await this.findOne(query)
    .populate('clinic', 'clinicId name shortName')
    .populate('patient', 'firstName lastName patientId')
    .populate('doctor', 'firstName lastName')
    .sort({ createdAt: -1 });
};

// CRITICAL: Check for conflicting sessions (any active session for patient by any doctor)
// MULTI-CLINIC: Conflicts are checked per-clinic (same patient can have sessions at different clinics)
consultationSessionSchema.statics.checkForConflicts = async function(patientId, excludeDoctorId = null, clinicId = null) {
  const query = {
    patient: patientId,
    status: 'active'
  };

  // MULTI-CLINIC: Check conflicts only within the same clinic
  if (clinicId) query.clinic = clinicId;

  // Optionally exclude sessions by a specific doctor
  if (excludeDoctorId) {
    query.doctor = { $ne: excludeDoctorId };
  }

  const conflictingSessions = await this.find(query)
    .populate('clinic', 'clinicId name shortName')
    .populate('doctor', 'firstName lastName')
    .sort({ createdAt: -1 });

  return conflictingSessions;
};

// Static method to create session with conflict detection
consultationSessionSchema.statics.createWithConflictCheck = async function(sessionData, options = {}) {
  const { allowConcurrent = false, forceCreate = false } = options;

  // Check for existing active sessions for this patient (at the same clinic)
  const existingActiveSessions = await this.checkForConflicts(sessionData.patient, null, sessionData.clinic);

  if (existingActiveSessions.length > 0 && !forceCreate) {
    // Check if any session is by a different doctor
    const otherDoctorSessions = existingActiveSessions.filter(
      s => s.doctor._id.toString() !== sessionData.doctor.toString()
    );

    if (otherDoctorSessions.length > 0 && !allowConcurrent) {
      const conflict = otherDoctorSessions[0];
      const error = new Error(
        `CONFLIT: Le patient a déjà une session active avec Dr. ${conflict.doctor.firstName} ${conflict.doctor.lastName} (démarrée le ${new Date(conflict.createdAt).toLocaleString('fr-FR')})`
      );
      error.code = 'SESSION_CONFLICT';
      error.conflictingSessions = otherDoctorSessions;
      throw error;
    }

    // Same doctor has an existing session - return it instead of creating new
    const ownSession = existingActiveSessions.find(
      s => s.doctor._id.toString() === sessionData.doctor.toString()
    );
    if (ownSession) {
      return {
        session: ownSession,
        isExisting: true,
        message: 'Session existante trouvée et récupérée'
      };
    }
  }

  // No conflicts or forceCreate - create new session
  const session = await this.create(sessionData);
  return {
    session,
    isExisting: false,
    message: 'Nouvelle session créée'
  };
};

// Static method to get recent sessions (filtered by clinic)
consultationSessionSchema.statics.getRecentSessions = async function(doctorId, clinicId = null, limit = 10) {
  const query = {
    doctor: doctorId,
    status: { $in: ['active', 'completed'] }
  };

  // MULTI-CLINIC: Optionally filter by clinic
  if (clinicId) query.clinic = clinicId;

  return await this.find(query)
    .populate('clinic', 'clinicId name shortName')
    .populate('patient', 'firstName lastName patientId')
    .populate('doctor', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Instance method to auto-save
consultationSessionSchema.methods.autoSave = async function() {
  this.lastAutoSave = new Date();
  this.autoSaveCount += 1;
  return await this.save();
};

// Instance method to complete session
consultationSessionSchema.methods.complete = async function(userId) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.completedBy = userId;

  // Calculate duration
  if (this.createdAt) {
    this.duration = Math.floor((this.completedAt - this.createdAt) / 1000);
  }

  await this.save();

  // Create or update Visit record for patient history
  const Visit = require('./Visit');
  const Appointment = require('./Appointment');

  console.log(`[COMPLETE] Starting visit creation for session ${this.sessionId}`);
  console.log('[COMPLETE] Has diagnostic.procedures:', !!(this.diagnostic?.procedures));
  console.log('[COMPLETE] Has diagnostic.laboratory:', !!(this.diagnostic?.laboratory));

  try {
    let visit = null;

    // CRITICAL FIX: Check if appointment already has a Visit to prevent duplicates
    if (this.appointment) {
      const appointment = await Appointment.findById(this.appointment);
      if (appointment?.visit) {
        // Visit already exists - update it instead of creating duplicate
        visit = await Visit.findById(appointment.visit);
        if (visit) {
          visit.status = 'in-progress'; // Will be set to 'completed' by completeVisit()
          visit.consultationSession = this._id;
          if (this.sessionData?.diagnoses) {
            visit.diagnoses = this.sessionData.diagnoses;
          }
          if (this.sessionData?.vitalSigns) {
            visit.vitalSigns = this.sessionData.vitalSigns;
          }
          await visit.save();
          console.log(`Updated existing Visit ${visit._id} for appointment ${this.appointment}`);
        }
      }
    }

    // If no existing visit found, create new one
    if (!visit) {
      const visitData = {
        patient: this.patient,
        appointment: this.appointment,
        visitDate: this.completedAt,
        visitType: 'consultation',
        primaryProvider: this.doctor,
        status: 'in-progress', // Will be set to 'completed' by completeVisit()
        chiefComplaint: this.sessionData?.chiefComplaint ? {
          complaint: this.sessionData.chiefComplaint.complaint || this.sessionData.chiefComplaint,
          duration: this.sessionData.chiefComplaint.duration,
          severity: this.sessionData.chiefComplaint.severity
        } : undefined,
        diagnoses: this.sessionData?.diagnoses || [],
        vitalSigns: this.sessionData?.vitalSigns,
        consultationSession: this._id,
        clinicalActs: [] // Initialize empty array
      };

      visit = await Visit.create(visitData);
      console.log(`Created new Visit ${visit._id} for consultation session ${this._id}`);

      // CRITICAL: Save visit reference to consultation session
      this.visit = visit._id;
      await this.save();

      // Update appointment with visit reference if appointment exists
      if (this.appointment) {
        await Appointment.findByIdAndUpdate(this.appointment, { visit: visit._id });
      }
    }

    // CRITICAL FIX: Extract exam data and add as clinical acts for billing
    if (visit) {
      const FeeSchedule = require('./FeeSchedule');
      const clinicalActsToAdd = [];

      // Check for refraction data
      if (this.refractionData && (this.refractionData.OD || this.refractionData.OG)) {
        let refractionPrice = 8000; // Default
        try {
          const feeSchedule = await FeeSchedule.findOne({
            code: 'EXAM-REFRACTION',
            active: true,
            $or: [
              { effectiveTo: null },
              { effectiveTo: { $gte: new Date() } }
            ]
          }).sort({ effectiveFrom: -1 });
          if (feeSchedule) refractionPrice = feeSchedule.price;
        } catch (err) {
          console.warn('Could not fetch fee schedule for refraction, using default:', err.message);
        }

        clinicalActsToAdd.push({
          actType: 'examination',
          actCode: 'EXAM-REFRACTION',
          actName: 'Refraction Test',
          provider: this.doctor,
          price: refractionPrice,
          status: 'completed',
          startTime: this.createdAt,
          endTime: this.completedAt,
          notes: this.refractionData.notes || ''
        });
        console.log(`[CLINICAL ACT] Added refraction test (${refractionPrice} CDF) to visit`);
      }

      // Check for contact lens fitting data
      if (this.contactLensData && (this.contactLensData.OD || this.contactLensData.OG)) {
        let contactLensPrice = 12000; // Default
        try {
          const feeSchedule = await FeeSchedule.findOne({
            code: 'EXAM-CONTACT-LENS',
            active: true,
            $or: [
              { effectiveTo: null },
              { effectiveTo: { $gte: new Date() } }
            ]
          }).sort({ effectiveFrom: -1 });
          if (feeSchedule) contactLensPrice = feeSchedule.price;
        } catch (err) {
          console.warn('Could not fetch fee schedule for contact lens, using default:', err.message);
        }

        clinicalActsToAdd.push({
          actType: 'examination',
          actCode: 'EXAM-CONTACT-LENS',
          actName: 'Contact Lens Fitting and Trial',
          provider: this.doctor,
          price: contactLensPrice,
          status: 'completed',
          startTime: this.createdAt,
          endTime: this.completedAt,
          notes: this.contactLensData.notes || ''
        });
        console.log(`[CLINICAL ACT] Added contact lens fitting (${contactLensPrice} CDF) to visit`);
      }

      // Check for orthoptic exam data
      if (this.orthopticData) {
        let orthopticPrice = 10000; // Default
        try {
          const feeSchedule = await FeeSchedule.findOne({
            code: 'EXAM-ORTHOPTIC',
            active: true,
            $or: [
              { effectiveTo: null },
              { effectiveTo: { $gte: new Date() } }
            ]
          }).sort({ effectiveFrom: -1 });
          if (feeSchedule) orthopticPrice = feeSchedule.price;
        } catch (err) {
          console.warn('Could not fetch fee schedule for orthoptic, using default:', err.message);
        }

        clinicalActsToAdd.push({
          actType: 'examination',
          actCode: 'EXAM-ORTHOPTIC',
          actName: 'Orthoptic Examination',
          provider: this.doctor,
          price: orthopticPrice,
          status: 'completed',
          startTime: this.createdAt,
          endTime: this.completedAt,
          notes: this.orthopticData.notes || ''
        });
        console.log(`[CLINICAL ACT] Added orthoptic exam (${orthopticPrice} CDF) to visit`);
      }

      // Extract imaging/diagnostic exams from dashboard data
      // FIXED: Also check this.procedures directly (not just this.diagnostic.procedures)
      const diagnosticExams = this.procedures || this.diagnostic?.procedures || this.diagnostic?.exams || this.sessionData?.procedures || this.sessionData?.diagnostic?.procedures || this.sessionData?.diagnostic?.exams || this.stepData?.procedures || [];
      if (Array.isArray(diagnosticExams) && diagnosticExams.length > 0) {
        for (const exam of diagnosticExams) {
          // Handle both string codes and procedure objects
          const examCode = typeof exam === 'string' ? exam : exam.code;
          try {
            const feeSchedule = await FeeSchedule.findOne({
              code: examCode,
              active: true,
              $or: [
                { effectiveTo: null },
                { effectiveTo: { $gte: new Date() } }
              ]
            }).sort({ effectiveFrom: -1 });

            if (feeSchedule) {
              clinicalActsToAdd.push({
                actType: 'examination',
                actCode: examCode,
                actName: feeSchedule.name,
                provider: this.doctor,
                price: feeSchedule.price,
                status: 'completed', // PRE-BILLED: Exams are billed when ordered
                startTime: this.createdAt,
                endTime: this.completedAt,
                notes: `Examen demandé: ${feeSchedule.name}`
              });
              console.log(`[CLINICAL ACT] Added exam ${examCode} (${feeSchedule.price} CDF) to visit - PRE-BILLED`);
            }
          } catch (err) {
            console.warn(`Could not fetch fee schedule for exam ${examCode}:`, err.message);
          }
        }
      }

      // Extract lab tests from dashboard data
      // FIXED: Also check this.stepData.laboratory for step-based workflow
      const labTests = this.laboratory || this.diagnostic?.laboratory || this.sessionData?.laboratory || this.sessionData?.diagnostic?.laboratory || this.stepData?.laboratory || [];
      if (Array.isArray(labTests) && labTests.length > 0) {
        // CRITICAL FIX: Create LabOrder document so tests appear in lab queue
        try {
          const LabOrder = require('./LabOrder');
          const labOrderTests = [];

          for (const lab of labTests) {
            // Handle both string codes and lab test objects
            const labCode = typeof lab === 'string' ? lab : lab.code;
            const labName = typeof lab === 'string' ? lab : (lab.name || lab.code);
            const labCategory = typeof lab === 'object' ? lab.category : 'Autre';
            const labUrgency = typeof lab === 'object' ? lab.urgency : 'routine';

            try {
              const feeSchedule = await FeeSchedule.findOne({
                code: labCode,
                active: true,
                $or: [
                  { effectiveTo: null },
                  { effectiveTo: { $gte: new Date() } }
                ]
              }).sort({ effectiveFrom: -1 });

              if (feeSchedule) {
                clinicalActsToAdd.push({
                  actType: 'laboratory',
                  actCode: labCode,
                  actName: feeSchedule.name,
                  provider: this.doctor,
                  price: feeSchedule.price,
                  status: 'completed', // PRE-BILLED: Lab tests are billed when ordered
                  startTime: this.createdAt,
                  endTime: this.completedAt,
                  notes: `Test demandé: ${feeSchedule.name}`
                });
                console.log(`[CLINICAL ACT] Added lab test ${labCode} (${feeSchedule.price} CDF) to visit - PRE-BILLED`);
              }

              // Add to lab order tests
              labOrderTests.push({
                testName: feeSchedule?.name || labName,
                testCode: labCode,
                category: labCategory,
                status: 'pending',
                notes: typeof lab === 'object' ? lab.notes : ''
              });
            } catch (err) {
              console.warn(`Could not fetch fee schedule for lab test ${labCode}:`, err.message);
              // Still add to lab order even without fee schedule
              labOrderTests.push({
                testName: labName,
                testCode: labCode,
                category: labCategory,
                status: 'pending',
                notes: typeof lab === 'object' ? lab.notes : ''
              });
            }
          }

          // Create the LabOrder document for lab queue
          if (labOrderTests.length > 0) {
            const labOrder = await LabOrder.create({
              patient: this.patient,
              visit: visit._id,
              appointment: this.appointment,
              orderedBy: this.doctor,
              priority: labTests.some(t => t.urgency === 'stat') ? 'stat' :
                labTests.some(t => t.urgency === 'urgent') ? 'urgent' : 'routine',
              status: 'ordered',
              tests: labOrderTests,
              clinicalNotes: `Ordered during consultation session ${this.sessionId}`
            });
            console.log(`[LAB ORDER] Created LabOrder ${labOrder.orderId} with ${labOrderTests.length} tests for visit ${visit.visitId}`);
          }
        } catch (labOrderErr) {
          console.error('[LAB ORDER] Error creating lab order:', labOrderErr.message);
          // Continue - clinical acts will still be added
        }
      }

      // Extract medications from prescription
      // FIXED: Also check stepData.prescription for step-based workflow
      const medications = this.prescription?.medications || this.sessionData?.prescription?.medications || this.stepData?.prescription?.medications || [];
      if (Array.isArray(medications) && medications.length > 0) {
        // CRITICAL FIX: Create a Prescription record for auto-dispense support
        // Without this, medications appear on invoices but cannot be auto-dispensed
        try {
          const Prescription = require('./Prescription');

          const prescriptionMedications = medications.map(med => ({
            name: med.name || med.medication,
            genericName: med.genericName || med.name || med.medication,
            dosage: med.dosage || '',
            frequency: med.frequency || '',
            duration: med.duration || '',
            route: med.route || 'oral',
            instructions: med.instructions || '',
            quantity: med.quantity || 1,
            unit: med.unit || 'unit'
          }));

          // Calculate validity: 90 days for medications
          const validUntil = new Date();
          validUntil.setDate(validUntil.getDate() + 90);

          const prescriptionData = {
            patient: this.patient,
            visit: visit._id,
            prescriber: this.doctor,
            medications: prescriptionMedications,
            status: 'pending', // Will be auto-dispensed when invoice is paid
            type: 'medication',
            validUntil: validUntil,
            notes: this.prescription?.notes || this.sessionData?.prescription?.notes || ''
          };

          const newPrescription = await Prescription.create(prescriptionData);

          // Link prescription to visit
          visit.prescriptions = visit.prescriptions || [];
          visit.prescriptions.push(newPrescription._id);
          await visit.save();

          console.log(`[PRESCRIPTION] Created prescription ${newPrescription.prescriptionId || newPrescription._id} with ${prescriptionMedications.length} medications for visit ${visit.visitId}`);
        } catch (prescErr) {
          console.error('[PRESCRIPTION] Error creating prescription record:', prescErr.message);
          // Continue - we still want to add medications to clinical acts for billing
        }

        // Add medications to clinical acts for billing
        for (const med of medications) {
          try {
            // First try to get price from medication data
            let unitPrice = med.price || med.unitPrice || 0;
            const quantity = med.quantity || 1;

            // If no price in medication data, try to look up from FeeSchedule
            if (!unitPrice && (med.code || med.name)) {
              const medCode = med.code || `MED_${(med.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
              try {
                const feeSchedule = await FeeSchedule.findOne({
                  code: medCode,
                  active: true,
                  $or: [
                    { effectiveTo: null },
                    { effectiveTo: { $gte: new Date() } }
                  ]
                }).sort({ effectiveFrom: -1 });

                if (feeSchedule) {
                  unitPrice = feeSchedule.price;
                  console.log(`[CLINICAL ACT] Found fee schedule for ${med.name}: ${unitPrice} CDF`);
                }
              } catch (err) {
                console.warn(`Could not fetch fee schedule for medication ${med.name}:`, err.message);
              }
            }

            const total = unitPrice * quantity;

            clinicalActsToAdd.push({
              actType: 'therapy', // Use valid enum value for medications
              actCode: med.code || med.name,
              actName: med.name || med.medication,
              provider: this.doctor,
              price: total,
              quantity: quantity,
              status: 'completed', // PRE-BILLED: Medications are billed when prescribed
              startTime: this.createdAt,
              endTime: this.completedAt,
              notes: med.dosage || med.instructions || ''
            });
            console.log(`[CLINICAL ACT] Added medication ${med.name} x${quantity} (${total} CDF total) to visit - PRE-BILLED`);
          } catch (err) {
            console.warn(`Could not add medication ${med.name || med.medication}:`, err.message);
          }
        }
      }

      // Add all clinical acts to the visit
      if (clinicalActsToAdd.length > 0) {
        visit.clinicalActs = visit.clinicalActs || [];
        visit.clinicalActs.push(...clinicalActsToAdd);
        await visit.save();
        console.log(`[CLINICAL ACT] Total acts added to visit: ${clinicalActsToAdd.length}`);
      } else {
        console.log('[CLINICAL ACT] No exam data found in session to bill');
      }
    }

    // CRITICAL FIX: Complete the visit (marks as completed & generates invoice)
    if (visit && visit.status === 'in-progress') {
      await visit.completeVisit(userId);
      console.log(`Visit ${visit.visitId} completed with invoice generation`);
    }

  } catch (error) {
    console.error('[COMPLETE ERROR] Error creating/updating visit record:', error.message);
    console.error('[COMPLETE ERROR] Error stack:', error.stack);
    console.error('[COMPLETE ERROR] Error code:', error.code);
    // Don't fail the completion if visit creation fails
  }

  return this;
};

// Instance method to abandon session
consultationSessionSchema.methods.abandon = async function() {
  this.status = 'abandoned';
  return await this.save();
};

module.exports = mongoose.model('ConsultationSession', consultationSessionSchema);
