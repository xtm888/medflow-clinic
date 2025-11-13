const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  // Identification
  prescriptionId: {
    type: String,
    unique: true,
    required: true
  },

  // Patient and Provider
  patient: {
    type: mongoose.Schema.ObjectId,
    ref: 'Patient',
    required: true
  },
  prescriber: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  appointment: {
    type: mongoose.Schema.ObjectId,
    ref: 'Appointment'
  },

  // Prescription Type
  type: {
    type: String,
    enum: ['medication', 'optical', 'therapy', 'medical-device', 'lab-test'],
    required: true
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'filled', 'partially-filled', 'cancelled', 'expired', 'on-hold'],
    default: 'active'
  },

  // Dates
  dateIssued: {
    type: Date,
    default: Date.now,
    required: true
  },
  validUntil: {
    type: Date,
    required: true
  },

  // Medications
  medications: [{
    name: {
      type: String,
      required: function() { return this.type === 'medication'; }
    },
    genericName: String,
    brand: String,
    dosage: String,
    strength: String,
    form: String, // tablet, capsule, liquid, cream, drops, etc.
    route: String, // oral, topical, ophthalmic, etc.
    frequency: String,
    duration: String,
    quantity: Number,
    unit: String,
    instructions: String,
    foodInstructions: String, // with food, empty stomach, etc.
    refills: {
      allowed: Number,
      remaining: Number
    },
    substitutionAllowed: {
      type: Boolean,
      default: true
    },
    indication: String, // reason for prescription
    sideEffects: [String],
    contraindications: [String],
    interactions: [String]
  }],

  // Optical Prescription
  optical: {
    prescriptionType: {
      type: String,
      enum: ['glasses', 'contacts', 'both']
    },
    // Right Eye (OD)
    OD: {
      sphere: Number,
      cylinder: Number,
      axis: Number,
      add: Number,
      prism: String,
      base: String,
      va: String, // visual acuity
      // Contact lens specific
      baseCurve: Number,
      diameter: Number,
      brand: String
    },
    // Left Eye (OS)
    OS: {
      sphere: Number,
      cylinder: Number,
      axis: Number,
      add: Number,
      prism: String,
      base: String,
      va: String,
      // Contact lens specific
      baseCurve: Number,
      diameter: Number,
      brand: String
    },
    // Pupillary Distance
    pd: {
      binocular: Number,
      monocular: {
        OD: Number,
        OS: Number
      }
    },
    // Additional measurements
    vertexDistance: Number,
    pantoscopicTilt: Number,
    frameWrap: Number,
    // Lens recommendations
    lensType: String, // single vision, bifocal, progressive, etc.
    lensMaterial: String,
    lensCoatings: [String],
    tint: String,
    specialInstructions: String
  },

  // Diagnosis
  diagnosis: [{
    code: String, // ICD-10 code
    description: String
  }],

  // Instructions
  instructions: {
    general: String,
    patient: String,
    pharmacy: String
  },

  // Allergies and Warnings
  allergies: [String],
  warnings: [String],
  precautions: [String],

  // Dispensing Information
  dispensing: [{
    dispensedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    dispensedAt: Date,
    pharmacy: {
      name: String,
      address: String,
      phone: String
    },
    quantity: Number,
    daysSupply: Number,
    lotNumber: String,
    expirationDate: Date,
    copayAmount: Number,
    totalCost: Number,
    notes: String
  }],

  // Insurance
  insurance: {
    used: {
      type: Boolean,
      default: false
    },
    provider: String,
    policyNumber: String,
    groupNumber: String,
    bin: String,
    pcn: String,
    priorAuthRequired: Boolean,
    priorAuthNumber: String,
    coverageStatus: String
  },

  // E-Prescription Details
  ePrescription: {
    enabled: {
      type: Boolean,
      default: false
    },
    transmittedAt: Date,
    transmissionId: String,
    sentTo: {
      pharmacy: String,
      ncpdpId: String
    },
    status: String,
    errorMessage: String
  },

  // Verification
  verification: {
    required: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    verifiedAt: Date,
    method: String, // manual, automatic, phone
    notes: String
  },

  // Controlled Substance Info
  controlledSubstance: {
    schedule: {
      type: String,
      enum: ['I', 'II', 'III', 'IV', 'V']
    },
    deaNumber: String,
    stateControlledSubstanceNumber: String
  },

  // Signature
  signature: {
    prescriber: {
      signed: {
        type: Boolean,
        default: false
      },
      signedAt: Date,
      signatureData: String // Base64 encoded signature image
    },
    patient: {
      signed: Boolean,
      signedAt: Date,
      signatureData: String
    }
  },

  // Notes
  notes: {
    clinical: String,
    pharmacy: String,
    internal: String
  },

  // Cancellation
  cancellation: {
    cancelled: {
      type: Boolean,
      default: false
    },
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    reason: String
  },

  // Renewal
  renewal: {
    isRenewal: {
      type: Boolean,
      default: false
    },
    originalPrescription: {
      type: mongoose.Schema.ObjectId,
      ref: 'Prescription'
    },
    renewalRequested: Boolean,
    renewalRequestedAt: Date,
    renewalApproved: Boolean,
    renewalApprovedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    renewalApprovedAt: Date
  },

  // Communication
  communications: [{
    type: {
      type: String,
      enum: ['patient-query', 'pharmacy-query', 'clarification', 'change-request']
    },
    from: String,
    to: String,
    message: String,
    response: String,
    timestamp: Date,
    resolved: Boolean
  }],

  // Audit
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  viewHistory: [{
    viewedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    viewedAt: Date,
    action: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
prescriptionSchema.index({ patient: 1, dateIssued: -1 });
prescriptionSchema.index({ prescriber: 1, status: 1 });
prescriptionSchema.index({ prescriptionId: 1 });
prescriptionSchema.index({ type: 1, status: 1 });
prescriptionSchema.index({ validUntil: 1 });

// Virtual for isExpired
prescriptionSchema.virtual('isExpired').get(function() {
  return new Date() > this.validUntil;
});

// Virtual for daysUntilExpiry
prescriptionSchema.virtual('daysUntilExpiry').get(function() {
  const today = new Date();
  const expiry = new Date(this.validUntil);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Generate prescription ID
prescriptionSchema.pre('save', async function(next) {
  if (!this.prescriptionId) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const count = await this.constructor.countDocuments({
      dateIssued: {
        $gte: new Date(year, date.getMonth(), 1),
        $lt: new Date(year, date.getMonth() + 1, 1)
      }
    });

    const typePrefix = {
      'medication': 'MED',
      'optical': 'OPT',
      'therapy': 'THR',
      'medical-device': 'DEV',
      'lab-test': 'LAB'
    };

    const prefix = typePrefix[this.type] || 'RX';
    this.prescriptionId = `${prefix}${year}${month}${String(count + 1).padStart(5, '0')}`;
  }

  // Set default validity period if not specified
  if (!this.validUntil) {
    const validityDays = this.type === 'optical' ? 365 : 90; // 1 year for optical, 90 days for medication
    this.validUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
  }

  // Update status based on expiry
  if (this.isExpired && this.status === 'active') {
    this.status = 'expired';
  }

  next();
});

// Check drug interactions
prescriptionSchema.methods.checkInteractions = async function(patientId) {
  // This would integrate with a drug interaction API
  // Placeholder for actual implementation
  const Patient = mongoose.model('Patient');
  const patient = await Patient.findById(patientId).populate('medications');

  const interactions = [];
  // Check logic would go here

  return interactions;
};

// Format for printing
prescriptionSchema.methods.formatForPrint = function() {
  const formatted = {
    prescriptionId: this.prescriptionId,
    date: this.dateIssued.toLocaleDateString(),
    patient: this.populated('patient') || this.patient,
    prescriber: this.populated('prescriber') || this.prescriber,
    validUntil: this.validUntil.toLocaleDateString()
  };

  if (this.type === 'medication') {
    formatted.medications = this.medications.map(med => ({
      name: med.name,
      dosage: `${med.strength} - ${med.dosage}`,
      instructions: `${med.frequency} for ${med.duration}`,
      quantity: `${med.quantity} ${med.unit}`,
      refills: med.refills.allowed
    }));
  } else if (this.type === 'optical') {
    formatted.optical = {
      OD: this.optical.OD,
      OS: this.optical.OS,
      pd: this.optical.pd,
      add: this.optical.OD.add || this.optical.OS.add
    };
  }

  return formatted;
};

module.exports = mongoose.model('Prescription', prescriptionSchema);