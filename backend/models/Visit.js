const mongoose = require('mongoose');
const Counter = require('./Counter');

const visitSchema = new mongoose.Schema({
  visitId: {
    type: String,
    unique: true,
    sparse: true
  },

  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },

  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },

  visitDate: {
    type: Date,
    default: Date.now,
    required: true
  },

  visitType: {
    type: String,
    enum: ['routine', 'emergency', 'follow-up', 'initial', 'procedure', 'consultation'],
    default: 'routine'
  },

  primaryProvider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  additionalProviders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Clinical Acts within the visit
  clinicalActs: [{
    actId: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    actType: {
      type: String,
      enum: ['consultation', 'procedure', 'examination', 'imaging', 'laboratory', 'therapy'],
      required: true
    },
    actCode: String, // CPT/procedure code
    actName: String,
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    startTime: Date,
    endTime: Date,
    duration: Number, // in minutes
    location: String,
    notes: String,
    status: {
      type: String,
      enum: ['planned', 'in-progress', 'completed', 'cancelled', 'deferred'],
      default: 'planned'
    },
    results: mongoose.Schema.Types.Mixed,
    attachments: [{
      type: String,
      url: String,
      description: String
    }]
  }],

  // Chief Complaint & History
  chiefComplaint: {
    complaint: String,
    duration: String,
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe', 'critical']
    },
    onset: String,
    associatedSymptoms: [String]
  },

  historyOfPresentIllness: String,

  reviewOfSystems: {
    constitutional: String,
    eyes: String,
    ears: String,
    cardiovascular: String,
    respiratory: String,
    gastrointestinal: String,
    genitourinary: String,
    musculoskeletal: String,
    neurological: String,
    psychiatric: String,
    endocrine: String,
    hematologic: String,
    allergic: String
  },

  // Physical Examination
  physicalExamination: {
    general: String,
    vitalSigns: {
      bloodPressure: String,
      heartRate: {
        type: Number,
        min: [20, 'Heart rate must be at least 20 bpm'],
        max: [300, 'Heart rate must not exceed 300 bpm']
      },
      temperature: {
        type: Number,
        min: [0, 'Temperature must be at least 0°C'],
        max: [45, 'Temperature must not exceed 45°C']
      },
      respiratoryRate: {
        type: Number,
        min: [4, 'Respiratory rate must be at least 4 breaths/min'],
        max: [60, 'Respiratory rate must not exceed 60 breaths/min']
      },
      oxygenSaturation: {
        type: Number,
        min: [0, 'Oxygen saturation must be at least 0%'],
        max: [100, 'Oxygen saturation must not exceed 100%']
      },
      weight: {
        type: Number,
        min: [0.3, 'Weight must be at least 0.3 kg'],
        max: [500, 'Weight must not exceed 500 kg']
      },
      height: {
        type: Number,
        min: [20, 'Height must be at least 20 cm'],
        max: [280, 'Height must not exceed 280 cm']
      },
      bmi: Number
    },
    heent: String,
    cardiovascular: String,
    respiratory: String,
    abdomen: String,
    extremities: String,
    neurological: String,
    skin: String,
    psychiatric: String
  },

  // Link to specialized examinations
  examinations: {
    refraction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OphthalmologyExam'
    },
    keratometry: {
      OD: {
        k1: Number,
        k2: Number,
        axis: Number,
        average: Number
      },
      OS: {
        k1: Number,
        k2: Number,
        axis: Number,
        average: Number
      },
      method: String
    },
    additionalTests: [{
      testName: String,
      result: mongoose.Schema.Types.Mixed,
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      performedAt: Date
    }]
  },

  // Pathology Findings (Template-based clinical findings)
  pathologyFindings: [{
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PathologyTemplate'
    },
    category: String, // e.g., "LAF", "Cataracte", "Diabète"
    subcategory: String, // e.g., "Cornée", "Cristallin"
    type: {
      type: String,
      enum: ['symptom', 'description', 'finding']
    },
    name: String, // Name of the finding from template
    value: String, // Optional additional value/description
    laterality: {
      type: String,
      enum: ['OD', 'OG', 'ODG', 'Droite', 'Gauche', 'Bilatéral']
    },
    severity: {
      type: String,
      enum: ['-', '+/-', '+', '++', '+++', '++++', '0']
    },
    location: {
      type: String,
      enum: ['Nasal', 'Temporal', 'Inférieur', 'Supérieur', 'Central', 'Périphérique']
    },
    clockPosition: {
      type: String,
      enum: ['1h', '2h', '3h', '4h', '5h', '6h', '7h', '8h', '9h', '10h', '11h', '12h', 'toute la périph']
    },
    notes: String, // Free-text notes for this finding
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    recordedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Laboratory Orders (Template-based lab test orders)
  laboratoryOrders: [{
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LaboratoryTemplate'
    },
    category: String,
    testName: String,
    testCode: String,
    specimen: {
      type: String,
      enum: ['Sang', 'Urine', 'Selles', 'LCR', 'Prélèvement', 'Autre']
    },
    orderedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    orderedAt: {
      type: Date,
      default: Date.now
    },
    priority: {
      type: String,
      enum: ['routine', 'urgent', 'stat'],
      default: 'routine'
    },
    status: {
      type: String,
      enum: ['ordered', 'collected', 'processing', 'completed', 'cancelled'],
      default: 'ordered'
    },
    result: String,
    resultValue: String,
    resultUnit: String,
    normalRange: String,
    isAbnormal: Boolean,
    resultedAt: Date,
    resultedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String
  }],

  // Examination Orders (Template-based examination/procedure orders)
  examinationOrders: [{
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExaminationTemplate'
    },
    category: String, // TYPE REFRACTION, OPHTALMOLOGIE, ECHOGRAPHIE
    examinationName: String,
    examinationCode: String,
    orderedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    orderedAt: {
      type: Date,
      default: Date.now
    },
    scheduledDate: Date,
    status: {
      type: String,
      enum: ['ordered', 'scheduled', 'in-progress', 'completed', 'cancelled'],
      default: 'ordered'
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    performedAt: Date,
    results: mongoose.Schema.Types.Mixed,
    notes: String
  }],

  // Diagnoses
  diagnoses: [{
    code: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['primary', 'secondary', 'rule-out', 'resolved'],
      default: 'primary'
    },
    laterality: {
      type: String,
      enum: ['OD', 'OS', 'OU', 'NA'],
      default: 'NA'
    },
    dateOfDiagnosis: Date,
    severity: String,
    notes: String
  }],

  // Linked prescriptions and procedures
  prescriptions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription'
  }],

  procedures: [{
    procedureCode: String,
    procedureName: String,
    laterality: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    performedAt: Date,
    notes: String,
    outcome: String,
    complications: String
  }],

  // IVT Treatments (Intravitreal Injections)
  ivtTreatments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IVTInjection' // Fixed: model is IVTInjection not IVTTreatment
  }],

  // Treatment Plan
  plan: {
    medications: [{
      medication: String,
      dosage: String,
      frequency: String,
      duration: String,
      route: String,
      instructions: String,
      prescribedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    followUp: {
      required: Boolean,
      timeframe: String,
      reason: String,
      withProvider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      scheduledDate: Date
    },
    referrals: [{
      toSpecialty: String,
      toProvider: String,
      reason: String,
      urgency: {
        type: String,
        enum: ['routine', 'urgent', 'emergent']
      },
      sentDate: Date,
      status: {
        type: String,
        enum: ['pending', 'sent', 'accepted', 'completed']
      }
    }],
    patientEducation: [{
      topic: String,
      materials: String,
      providedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    lifestyle: [{
      recommendation: String,
      category: String
    }]
  },

  // Documents and attachments
  documents: [{
    type: {
      type: String,
      enum: ['image', 'pdf', 'audio', 'video', 'letter', 'report', 'lab', 'imaging'],
      required: true
    },
    name: String,
    url: String,
    description: String,
    category: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    metadata: mongoose.Schema.Types.Mixed
  }],

  // Billing information
  billing: {
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'submitted', 'approved', 'denied', 'paid'],
      default: 'pending'
    },
    codes: [{
      type: String,
      code: String,
      description: String,
      modifier: String
    }],
    totalCharges: Number,
    insuranceCoverage: Number,
    patientResponsibility: Number,
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice'
    }
  },

  // Clinical and internal notes
  notes: {
    clinical: String,
    internal: String,
    nursing: String,
    administrative: String
  },

  // Visit status and completion
  status: {
    type: String,
    enum: ['scheduled', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled'
  },

  checkInTime: Date,
  startTime: Date,
  endTime: Date,

  completedAt: Date,
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  signedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  signedAt: Date,
  signatureStatus: {
    type: String,
    enum: ['unsigned', 'signed', 'locked'],
    default: 'unsigned'
  },

  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Quality metrics
  qualityMetrics: {
    documentationComplete: Boolean,
    timeSpent: Number, // minutes
    patientSatisfaction: Number,
    clinicalQualityScore: Number
  },

  // Optimistic locking - prevents lost updates from concurrent modifications
  version: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  optimisticConcurrency: true,
  versionKey: 'version'
});

// Indexes
visitSchema.index({ patient: 1, visitDate: -1 });
visitSchema.index({ visitId: 1 });
visitSchema.index({ primaryProvider: 1, visitDate: -1 });
visitSchema.index({ status: 1 });
visitSchema.index({ 'appointment': 1 });

// CRITICAL: Validate dates to prevent future dates where inappropriate
visitSchema.pre('save', function(next) {
  const now = new Date();

  // Visit date should not be in the future (can't have a visit that hasn't happened)
  if (this.visitDate && new Date(this.visitDate) > now) {
    const error = new Error('Visit date cannot be in the future');
    error.name = 'ValidationError';
    error.statusCode = 400;
    return next(error);
  }

  // Check-in time should not be in the future
  if (this.checkIn?.checkInTime && new Date(this.checkIn.checkInTime) > now) {
    const error = new Error('Check-in time cannot be in the future');
    error.name = 'ValidationError';
    error.statusCode = 400;
    return next(error);
  }

  // Check-out time should not be in the future
  if (this.checkOut?.checkOutTime && new Date(this.checkOut.checkOutTime) > now) {
    const error = new Error('Check-out time cannot be in the future');
    error.name = 'ValidationError';
    error.statusCode = 400;
    return next(error);
  }

  // Completed visit time should not be in the future
  if (this.completedAt && new Date(this.completedAt) > now) {
    const error = new Error('Visit completion time cannot be in the future');
    error.name = 'ValidationError';
    error.statusCode = 400;
    return next(error);
  }

  next();
});

// Generate unique visitId before saving (ATOMIC - uses Counter model)
visitSchema.pre('save', async function(next) {
  if (!this.visitId) {
    const date = new Date(this.visitDate);
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const counterId = `visit-${dateStr}`;

    // Use atomic counter to prevent race conditions
    const sequence = await Counter.getNextSequence(counterId);
    this.visitId = `VIS${dateStr}${sequence.toString().padStart(4, '0')}`;
  }

  // Calculate BMI if height and weight are provided
  if (this.physicalExamination?.vitalSigns?.height && this.physicalExamination?.vitalSigns?.weight) {
    const heightInMeters = this.physicalExamination.vitalSigns.height / 100;
    this.physicalExamination.vitalSigns.bmi =
      (this.physicalExamination.vitalSigns.weight / (heightInMeters * heightInMeters)).toFixed(1);
  }

  // Calculate total time spent
  if (this.startTime && this.endTime) {
    this.qualityMetrics = this.qualityMetrics || {};
    this.qualityMetrics.timeSpent = Math.round((this.endTime - this.startTime) / 60000); // minutes
  }

  next();
});

// Virtual for visit duration
visitSchema.virtual('duration').get(function() {
  if (this.startTime && this.endTime) {
    return Math.round((this.endTime - this.startTime) / 60000); // minutes
  }
  return null;
});

// Method to add clinical act
visitSchema.methods.addClinicalAct = function(actData) {
  this.clinicalActs.push(actData);
  return this.save();
};

// Method to link prescription to visit
visitSchema.methods.addPrescription = async function(prescriptionId) {
  if (!this.prescriptions.includes(prescriptionId)) {
    this.prescriptions.push(prescriptionId);
    await this.save();
  }
  return this;
};

// Method to link IVT treatment to visit
visitSchema.methods.addIVTTreatment = async function(ivtTreatmentId) {
  if (!this.ivtTreatments.includes(ivtTreatmentId)) {
    this.ivtTreatments.push(ivtTreatmentId);
    await this.save();
  }
  return this;
};

// Method to get complete visit summary
visitSchema.methods.getCompleteSummary = async function() {
  await this.populate([
    { path: 'patient', select: 'firstName lastName patientId dateOfBirth' },
    { path: 'primaryProvider', select: 'firstName lastName role' },
    { path: 'prescriptions' },
    { path: 'ivtTreatments' },
    { path: 'billing.invoice' }
  ]);

  return {
    visitId: this.visitId,
    visitDate: this.visitDate,
    patient: this.patient,
    provider: this.primaryProvider,
    chiefComplaint: this.chiefComplaint?.complaint,
    diagnoses: this.diagnoses,
    prescriptions: this.prescriptions,
    ivtTreatments: this.ivtTreatments,
    clinicalActs: this.clinicalActs,
    status: this.status,
    invoice: this.billing?.invoice,
    completedAt: this.completedAt
  };
};

// Method to complete visit with full cascade logic (WITH TRANSACTION SUPPORT)
visitSchema.methods.completeVisit = async function(userId) {
  const mongoose = require('mongoose');
  const Invoice = require('./Invoice');
  const Prescription = require('./Prescription');
  const Appointment = require('./Appointment');

  // Start MongoDB transaction for data consistency
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Reserve inventory for all prescriptions
    const reservationResults = [];
    for (const prescriptionId of this.prescriptions) {
      try {
        const prescription = await Prescription.findById(prescriptionId).session(session);
        if (prescription && prescription.type === 'medication') {
          const result = await prescription.reserveInventory(userId, session);
          reservationResults.push({
            prescriptionId: prescription.prescriptionId,
            success: result.success,
            results: result.results
          });

          // Update prescription status to ready for dispensing
          if (result.success) {
            prescription.status = 'ready';
            prescription.pharmacyStatus = 'ready';
            await prescription.save({ session });
          }
        }
      } catch (error) {
        reservationResults.push({
          prescriptionId,
          success: false,
          error: error.message
        });
        // Continue processing other prescriptions
      }
    }

    // 2. Generate invoice if not already created
    let invoiceData = null;
    if (!this.billing.invoice) {
      try {
        invoiceData = await this.generateInvoice(userId, session);
        if (invoiceData.invoice) {
          this.billing.invoice = invoiceData.invoice._id;
        }
      } catch (error) {
        console.error('Error generating invoice:', error);
        // Continue without invoice if it fails
      }
    }

    // 3. Update appointment status if linked
    if (this.appointment) {
      try {
        const appointment = await Appointment.findById(this.appointment).session(session);
        if (appointment && appointment.status !== 'completed') {
          appointment.status = 'completed';
          appointment.completedAt = new Date();
          await appointment.save({ session });
        }
      } catch (error) {
        console.error('Error updating appointment:', error);
        // Continue without appointment update if it fails
      }
    }

    // 4. Complete the visit
    this.status = 'completed';
    this.completedAt = new Date();
    this.completedBy = userId;
    this.endTime = this.endTime || new Date();

    await this.save({ session });

    // Commit transaction - all or nothing
    await session.commitTransaction();

    return {
      success: true,
      visit: this,
      reservations: reservationResults,
      invoiceGenerated: !!this.billing.invoice
    };

  } catch (error) {
    // Rollback all changes on error
    await session.abortTransaction();
    console.error('Visit completion failed, rolling back:', error);
    throw error;
  } finally {
    // Clean up session
    session.endSession();
  }
};

// Method to sign visit
visitSchema.methods.signVisit = function(userId) {
  this.signedBy = userId;
  this.signedAt = new Date();
  this.signatureStatus = 'signed';
  return this.save();
};

// Method to lock visit (no further edits)
visitSchema.methods.lockVisit = function() {
  this.signatureStatus = 'locked';
  return this.save();
};

// Method to generate invoice from visit
visitSchema.methods.generateInvoice = async function(userId) {
  const Invoice = require('./Invoice');
  const Prescription = require('./Prescription');

  // Check if invoice already exists
  if (this.billing.invoice) {
    const existingInvoice = await Invoice.findById(this.billing.invoice);
    if (existingInvoice) {
      return { success: true, invoice: existingInvoice, alreadyExists: true };
    }
  }

  const items = [];
  let subtotal = 0;

  // 1. Add consultation/visit fee
  const consultationFee = this.visitType === 'initial' ? 15000 : 10000; // CFA
  items.push({
    category: 'consultation',
    description: `Consultation - ${this.visitType}`,
    code: 'CONS-001',
    quantity: 1,
    unitPrice: consultationFee,
    subtotal: consultationFee,
    provider: this.primaryProvider
  });
  subtotal += consultationFee;

  // 2. Add clinical acts
  for (const act of this.clinicalActs || []) {
    if (act.status === 'completed') {
      const actPrice = 5000; // Default price, should be from settings/pricing
      items.push({
        category: 'procedure',
        description: act.actName || act.actType,
        code: act.actCode,
        quantity: 1,
        unitPrice: actPrice,
        subtotal: actPrice,
        provider: act.provider
      });
      subtotal += actPrice;
    }
  }

  // 3. Add prescriptions (medication costs)
  for (const prescriptionId of this.prescriptions || []) {
    try {
      const prescription = await Prescription.findById(prescriptionId)
        .populate('medications.inventoryItem');

      if (prescription && prescription.type === 'medication') {
        for (const med of prescription.medications || []) {
          const medPrice = med.pricing?.totalCost || 0;
          if (medPrice > 0) {
            items.push({
              category: 'medication',
              description: med.name || med.genericName,
              code: med.drug?.toString() || 'MED-001',
              quantity: med.quantity,
              unitPrice: med.pricing?.unitPrice || 0,
              subtotal: medPrice,
              prescription: prescriptionId
            });
            subtotal += medPrice;
          }
        }
      }
    } catch (error) {
      console.error('Error adding prescription to invoice:', error);
    }
  }

  // 4. Calculate totals
  const taxRate = 0; // No tax for medical services
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  // 5. Create invoice (invoiceId auto-generated by Invoice pre-save hook using atomic Counter)
  const invoice = await Invoice.create({
    // invoiceId omitted - let Invoice model's pre-save hook generate it atomically
    patient: this.patient,
    visit: this._id,
    items,
    summary: {
      subtotal,
      tax,
      total,
      amountDue: total
    },
    currency: 'CFA',
    status: 'draft',
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    createdBy: userId
  });

  // 6. Update visit billing
  this.billing.invoice = invoice._id;
  this.billing.totalCharges = total;
  this.billing.status = 'pending';
  await this.save();

  return {
    success: true,
    invoice,
    itemsCount: items.length,
    total
  };
};

// Static method to get visit timeline
visitSchema.statics.getTimeline = async function(patientId, limit = 10) {
  return this.find({ patient: patientId })
    .sort({ visitDate: -1 })
    .limit(limit)
    .populate('primaryProvider', 'firstName lastName')
    .populate('appointment', 'type reason')
    .select('visitId visitDate visitType status diagnoses chiefComplaint');
};

module.exports = mongoose.model('Visit', visitSchema);