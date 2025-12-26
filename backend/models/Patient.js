const mongoose = require('mongoose');
const Counter = require('./Counter');
const { phiEncryptionPlugin, PHI_FIELDS } = require('../utils/phiEncryption');

const patientSchema = new mongoose.Schema({
  // Identification
  patientId: {
    type: String,
    unique: true
    // Not required here - auto-generated in pre-save hook
  },
  nationalId: {
    type: String,
    unique: true,
    sparse: true
  },

  // Legacy System Integration (for migration from old EMR systems)
  legacyId: {
    type: String,
    sparse: true,
    index: true
  },
  legacyPatientNumber: {
    type: String,
    sparse: true
  },
  // Multiple legacy IDs from different systems
  legacyIds: {
    // DMI system ID (format: 10001A01)
    dmi: {
      type: String,
      sparse: true,
      index: true
    },
    // Other legacy systems
    dmiEye: String,
    oldEmr: String,
    externalRef: String
  },

  // Multi-Clinic: Where patient was first registered
  registeredAtClinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic'
  },
  // Primary/home clinic for this patient (can be different from registration)
  homeClinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    index: true  // Index for clinic-based filtering
  },

  // Folder IDs from various device shares (NIDEK, Zeiss, Solix, etc.)
  folderIds: [{
    deviceType: {
      type: String,
      enum: ['zeiss', 'solix', 'nidek', 'tomey', 'topcon', 'heidelberg', 'quantel', 'other']
    },
    folderId: String,      // Folder name on device share
    path: String,          // Full network path
    linkedAt: {
      type: Date,
      default: Date.now
    },
    linkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Data completeness status (for legacy imports with placeholder data)
  dataStatus: {
    type: String,
    enum: ['complete', 'incomplete', 'pending_verification'],
    default: 'complete'
  },
  // Track which fields have placeholder data
  placeholderFields: [{
    type: String,
    enum: ['dateOfBirth', 'gender', 'phoneNumber', 'email', 'address', 'bloodType']
  }],
  // When data was last verified/updated by staff
  dataVerifiedAt: {
    type: Date
  },
  dataVerifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Personal Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    uppercase: true // Auto-convert to UPPERCASE per convention requirements
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    uppercase: true // Auto-convert to UPPERCASE per convention requirements
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  bloodType: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  },
  occupation: {
    type: String,
    trim: true
  },
  maritalStatus: {
    type: String,
    enum: ['single', 'married', 'divorced', 'widowed', 'separated', '']
  },

  // VIP and Priority Status
  vip: {
    type: Boolean,
    default: false
  },
  // Priority for vulnerable persons (pregnant women, elderly)
  priority: {
    type: String,
    enum: ['normal', 'pregnant', 'elderly'],
    default: 'normal'
  },

  // Photo
  photoPath: {
    type: String,
    default: null
  },
  photoUrl: {
    type: String,
    default: null
  },

  // Facial Recognition / Biometric Data
  biometric: {
    // Face encoding vector (128-dimensional array from face_recognition)
    faceEncoding: {
      type: [Number],
      default: null,
      select: false  // Don't include in queries by default for security
    },
    // When the face encoding was captured
    encodingCapturedAt: {
      type: Date,
      default: null
    },
    // Who captured the encoding (staff member)
    encodingCapturedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    // Face location in the original photo
    faceLocation: {
      top: Number,
      right: Number,
      bottom: Number,
      left: Number
    },
    // Has patient consented to biometric storage
    consentGiven: {
      type: Boolean,
      default: false
    },
    consentDate: {
      type: Date,
      default: null
    },
    // Last verification attempt
    lastVerification: {
      date: Date,
      success: Boolean,
      confidence: Number,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    // History of encoding updates (audit trail)
    encodingHistory: [{
      updatedAt: Date,
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      reason: String
    }]
  },

  // Contact Information
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    validate: {
      validator: function(v) {
        // Accept international formats: +243..., 00243..., or local formats
        // Allows digits, spaces, dashes, parentheses - minimum 6 digits
        const cleaned = v.replace(/[\s\-\(\)\.]/g, '');
        return /^(\+|00)?[0-9]{6,15}$/.test(cleaned);
      },
      message: 'Please provide a valid phone number'
    }
  },
  alternativePhone: {
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        const cleaned = v.replace(/[\s\-\(\)\.]/g, '');
        return /^(\+|00)?[0-9]{6,15}$/.test(cleaned);
      },
      message: 'Please provide a valid phone number'
    }
  },
  email: {
    type: String,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: {
      type: String,
      default: 'RD Congo'
    }
  },

  // Emergency Contact
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
    email: String
  },

  // Insurance Information
  insurance: {
    provider: String,
    policyNumber: String,
    groupNumber: String,
    validUntil: Date,
    coverageType: String,
    copayAmount: Number
  },

  // Convention / Corporate Coverage (Entreprise Conventionnée)
  convention: {
    // Link to Company/Employer
    company: {
      type: mongoose.Schema.ObjectId,
      ref: 'Company'
    },
    // Employee ID / Matricule
    employeeId: {
      type: String,
      trim: true
    },
    // Job title / position
    jobTitle: String,
    // Department within company
    department: String,
    // Coverage percentage override (if different from company default)
    coveragePercentage: {
      type: Number,
      min: 0,
      max: 100
    },
    // Validity dates
    validFrom: Date,
    validUntil: Date,
    // Status
    status: {
      type: String,
      enum: ['active', 'suspended', 'terminated', 'pending'],
      default: 'active'
    },
    // Beneficiary type
    beneficiaryType: {
      type: String,
      enum: ['employee', 'spouse', 'child', 'dependent'],
      default: 'employee'
    },
    // For dependents: link to primary employee
    primaryEmployee: {
      type: mongoose.Schema.ObjectId,
      ref: 'Patient'
    },
    // Annual limit tracking
    annualUsage: {
      year: Number,
      totalBilled: { type: Number, default: 0 },
      totalCovered: { type: Number, default: 0 },
      visitCount: { type: Number, default: 0 }
    },
    // Enrollment date
    enrolledAt: Date,
    // Notes
    notes: String
  },

  // Insurance documents (scanned cards, approvals, external prescriptions)
  insuranceDocuments: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Document'
  }],

  // Referrer/Referring Doctor (for commission tracking)
  referrer: {
    type: mongoose.Schema.ObjectId,
    ref: 'Referrer'
  },

  // Custom commission override for this patient
  referrerCommission: {
    type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    rate: Number, // percentage (0-100) or fixed amount
    notes: String
  },

  // Bon externe reference
  externalReferenceNumber: String,

  // Medical History
  medicalHistory: {
    allergies: [{
      allergen: String,
      reaction: String,
      severity: {
        type: String,
        enum: ['mild', 'moderate', 'severe']
      }
    }],
    chronicConditions: [{
      condition: String,
      diagnosedDate: Date,
      status: {
        type: String,
        enum: ['active', 'managed', 'resolved']
      }
    }],
    surgeries: [{
      procedure: String,
      date: Date,
      hospital: String,
      surgeon: String,
      notes: String
    }],
    familyHistory: [{
      relation: String,
      condition: String,
      ageAtDiagnosis: Number,
      // Enhanced fields for ophthalmology
      isOcularCondition: {
        type: Boolean,
        default: false
      },
      specificEyeCondition: {
        type: String,
        enum: [
          'glaucoma',
          'macular_degeneration',
          'retinal_detachment',
          'diabetic_retinopathy',
          'cataract',
          'high_myopia',
          'keratoconus',
          'retinitis_pigmentosa',
          'strabismus',
          'amblyopia',
          'color_blindness',
          'other'
        ]
      },
      inheritancePattern: {
        type: String,
        enum: [
          'autosomal_dominant',
          'autosomal_recessive',
          'x_linked',
          'mitochondrial',
          'multifactorial',
          'unknown'
        ]
      },
      affectedEye: {
        type: String,
        enum: ['OD', 'OS', 'OU']
      },
      notes: String
    }],
    socialHistory: {
      smoking: {
        status: {
          type: String,
          enum: ['never', 'former', 'current']
        },
        packsPerDay: Number,
        yearsSmoking: Number,
        quitDate: Date
      },
      alcohol: {
        status: {
          type: String,
          enum: ['never', 'occasional', 'moderate', 'heavy']
        },
        drinksPerWeek: Number
      },
      exercise: {
        frequency: {
          type: String,
          enum: ['none', 'occasional', 'regular', 'daily']
        },
        type: String
      }
    }
  },

  // Current Medications
  medications: [{
    name: String,
    dosage: String,
    frequency: String,
    startDate: Date,
    endDate: Date,
    prescribedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    reason: String,
    status: {
      type: String,
      enum: ['active', 'completed', 'discontinued'],
      default: 'active'
    }
  }],

  // Vital Signs (Latest)
  vitalSigns: {
    height: Number, // cm
    weight: Number, // kg
    bmi: Number,
    bloodPressure: {
      systolic: Number,
      diastolic: Number
    },
    heartRate: Number, // bpm
    temperature: Number, // Celsius
    respiratoryRate: Number,
    oxygenSaturation: Number, // percentage
    lastUpdated: Date
  },

  // Ophthalmology Specific
  ophthalmology: {
    lastEyeExam: Date,
    visualAcuity: {
      OD: {
        distance: String,
        near: String
      },
      OS: {
        distance: String,
        near: String
      },
      OU: {
        distance: String,
        near: String
      }
    },
    currentPrescription: {
      OD: {
        sphere: Number,
        cylinder: Number,
        axis: Number,
        add: Number,
        prism: String,
        va: String
      },
      OS: {
        sphere: Number,
        cylinder: Number,
        axis: Number,
        add: Number,
        prism: String,
        va: String
      },
      pd: {
        distance: Number,
        near: Number
      },
      prescribedDate: Date,
      prescribedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      }
    },
    eyeConditions: [{
      condition: String,
      eye: {
        type: String,
        enum: ['OD', 'OS', 'OU']
      },
      diagnosedDate: Date,
      status: String,
      treatment: String
    }],
    surgicalHistory: [{
      procedure: String,
      eye: {
        type: String,
        enum: ['OD', 'OS', 'OU']
      },
      date: Date,
      surgeon: String,
      outcome: String
    }],
    intraocularPressure: {
      OD: Number,
      OS: Number,
      method: String,
      lastMeasured: Date
    },
    pupilDistance: {
      binocular: Number,
      monocular: {
        OD: Number,
        OS: Number
      }
    }
  },

  // Pediatric Specific Data
  pediatric: {
    birthHistory: {
      gestationalAge: {
        type: Number,
        min: 20,
        max: 45 // weeks
      },
      birthWeight: Number, // grams
      apgarScore: {
        type: Number,
        min: 0,
        max: 10
      },
      nicuStay: {
        type: Boolean,
        default: false
      },
      nicuDuration: Number, // days
      deliveryType: {
        type: String,
        enum: ['vaginal', 'cesarean', 'forceps', 'vacuum', 'unknown']
      },
      complications: [String],
      ropScreening: [{
        date: Date,
        zone: {
          type: String,
          enum: ['I', 'II', 'III']
        },
        stage: {
          type: Number,
          min: 0,
          max: 5
        },
        plus: Boolean,
        treatment: String,
        outcome: String
      }]
    },
    developmentalMilestones: {
      fixAndFollow: {
        achieved: Boolean,
        ageMonths: Number,
        notes: String
      },
      socialSmile: {
        achieved: Boolean,
        ageMonths: Number
      },
      reachesForObjects: {
        achieved: Boolean,
        ageMonths: Number
      },
      recognizesFaces: {
        achieved: Boolean,
        ageMonths: Number
      },
      trackingHorizontal: {
        achieved: Boolean,
        ageMonths: Number
      },
      trackingVertical: {
        achieved: Boolean,
        ageMonths: Number
      },
      convergence: {
        achieved: Boolean,
        ageMonths: Number
      },
      colorRecognition: {
        achieved: Boolean,
        ageMonths: Number
      },
      assessmentDate: Date,
      assessedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      overallStatus: {
        type: String,
        enum: ['normal', 'delayed', 'concerning', 'not_assessed']
      },
      notes: String
    },
    amblyopiaRiskFactors: [{
      factor: {
        type: String,
        enum: [
          'strabismus',
          'anisometropia',
          'high_refractive_error',
          'ptosis',
          'cataract',
          'corneal_opacity',
          'family_history',
          'premature_birth',
          'neurological_condition',
          'media_opacity',
          'nystagmus',
          'other'
        ]
      },
      eye: {
        type: String,
        enum: ['OD', 'OS', 'OU']
      },
      detected: Date,
      severity: {
        type: String,
        enum: ['mild', 'moderate', 'severe']
      },
      status: {
        type: String,
        enum: ['active', 'treated', 'resolved', 'monitoring'],
        default: 'active'
      },
      treatment: String,
      notes: String
    }],
    treatmentHistory: [{
      type: {
        type: String,
        enum: ['patching', 'atropine', 'glasses', 'surgery', 'vision_therapy', 'other']
      },
      eye: {
        type: String,
        enum: ['OD', 'OS', 'OU']
      },
      startDate: Date,
      endDate: Date,
      protocol: String, // e.g., "2 hours daily patching"
      compliance: {
        type: String,
        enum: ['excellent', 'good', 'fair', 'poor']
      },
      outcome: String,
      notes: String
    }],
    schoolVisionScreening: [{
      date: Date,
      passedScreening: Boolean,
      referralMade: Boolean,
      notes: String
    }]
  },

  // Appointments
  appointments: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Appointment'
  }],

  // Prescriptions
  prescriptions: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Prescription'
  }],

  // Lab Results
  labResults: [{
    type: mongoose.Schema.ObjectId,
    ref: 'LabResult'
  }],

  // Imaging Studies
  imagingStudies: [{
    type: mongoose.Schema.ObjectId,
    ref: 'ImagingStudy'
  }],

  // Invoices
  invoices: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Invoice'
  }],

  // Account Balance (cached for quick lookups, updated on payment/invoice changes)
  accountBalance: {
    // Total amount across all invoices
    totalBilled: {
      type: Number,
      default: 0
    },
    // Total amount paid
    totalPaid: {
      type: Number,
      default: 0
    },
    // Outstanding balance (totalBilled - totalPaid)
    outstanding: {
      type: Number,
      default: 0
    },
    // Number of overdue invoices
    overdueCount: {
      type: Number,
      default: 0
    },
    // Total overdue amount
    overdueAmount: {
      type: Number,
      default: 0
    },
    // Credit balance (prepayments, refunds, etc.)
    credit: {
      type: Number,
      default: 0
    },
    // Last time balance was recalculated
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    // Payment history summary
    paymentHistory: {
      lastPaymentDate: Date,
      lastPaymentAmount: Number,
      paymentCount: {
        type: Number,
        default: 0
      }
    }
  },

  // Documents
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadedAt: Date,
    uploadedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
  }],

  // Preferences
  preferences: {
    language: {
      type: String,
      default: 'fr'
    },
    communicationMethod: {
      type: String,
      enum: ['phone', 'sms', 'email', 'whatsapp'],
      default: 'phone'
    },
    appointmentReminders: {
      type: Boolean,
      default: true
    },
    reminderTiming: {
      type: Number,
      default: 24 // hours before appointment
    }
  },

  // Preferred Pharmacy
  preferredPharmacy: {
    name: String,
    address: String,
    phone: String
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'deceased', 'transferred'],
    default: 'active'
  },

  // Soft Delete Support
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    default: null
  },
  deletionReason: {
    type: String,
    default: null
  },

  registrationDate: {
    type: Date,
    default: Date.now
  },
  lastVisit: Date,
  nextAppointment: Date,

  // Notes
  notes: [{
    content: String,
    category: String,
    createdAt: Date,
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    isPrivate: {
      type: Boolean,
      default: false
    }
  }],

  // Consent
  consent: {
    dataSharing: {
      status: Boolean,
      date: Date
    },
    emailCommunication: {
      status: Boolean,
      date: Date
    },
    smsCommunication: {
      status: Boolean,
      date: Date
    },
    researchParticipation: {
      status: Boolean,
      date: Date
    }
  },

  // Risk Factors
  riskFactors: {
    fallRisk: {
      type: String,
      enum: ['low', 'medium', 'high']
    },
    diabeticRetinopathyRisk: {
      type: String,
      enum: ['low', 'medium', 'high']
    },
    glaucomaRisk: {
      type: String,
      enum: ['low', 'medium', 'high']
    },
    cardiovascularRisk: {
      type: String,
      enum: ['low', 'medium', 'high']
    }
  },

  // =====================================================
  // PATIENT ALERTS - StudioVision Parity
  // Color-coded alerts banner system
  // =====================================================
  patientAlerts: [{
    type: {
      type: String,
      enum: ['allergy', 'reminder', 'success', 'urgent', 'info', 'warning'],
      required: true
    },
    message: {
      type: String,
      required: true
    },
    messageFr: String, // French message
    // Alert details
    details: String,
    // Source of alert
    sourceType: {
      type: String,
      enum: [
        'allergy',
        'overdue_followup',
        'lab_result',
        'medication_interaction',
        'iop_elevated',
        'glaucoma_progression',
        'cataract_progression',
        'appointment_reminder',
        'payment_due',
        'prescription_expiring',
        'manual'
      ]
    },
    sourceId: {
      type: mongoose.Schema.ObjectId,
      refPath: 'patientAlerts.sourceModel'
    },
    sourceModel: {
      type: String,
      enum: ['Appointment', 'Prescription', 'Invoice', 'LabOrder', 'OphthalmologyExam', 'ClinicalAlert']
    },
    // Auto-generated vs manual
    autoGenerated: {
      type: Boolean,
      default: false
    },
    // Priority for sorting
    priority: {
      type: Number,
      default: 0 // Higher = more important
    },
    // Expiration
    expiresAt: Date,
    // Dismissal tracking
    dismissedAt: Date,
    dismissedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    // Acknowledgement tracking
    acknowledgedAt: Date,
    acknowledgedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    // Display settings
    showOnDashboard: {
      type: Boolean,
      default: true
    },
    // Audit
    createdAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
  }],

  // Stored Payment Methods (for auto-pay on payment plans)
  storedPaymentMethods: [{
    // Unique identifier for this payment method
    id: {
      type: String,
      default: function() {
        return require('crypto').randomBytes(8).toString('hex');
      }
    },
    // Payment method type
    type: {
      type: String,
      enum: ['card', 'stripe', 'orange-money', 'mtn-money', 'wave', 'bank-account'],
      required: true
    },
    // Display name
    nickname: String,
    // For cards: last 4 digits
    last4: String,
    // For cards: brand (visa, mastercard, etc.)
    brand: String,
    // For cards: expiry
    expiryMonth: Number,
    expiryYear: Number,
    // For mobile money: phone number (stored securely, last 4 only for display)
    phoneNumber: String,
    phoneNumberLast4: String,
    // Provider-specific IDs
    stripePaymentMethodId: String,
    stripeCustomerId: String,
    // For bank accounts
    bankName: String,
    accountNumberLast4: String,
    // Status
    isDefault: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    // Verification
    verified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date,
    // Billing address (for cards)
    billingAddress: {
      street: String,
      city: String,
      postalCode: String,
      country: String
    },
    // Audit
    addedAt: {
      type: Date,
      default: Date.now
    },
    addedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    lastUsedAt: Date,
    usageCount: {
      type: Number,
      default: 0
    }
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

  // Optimistic locking - prevents lost updates from concurrent modifications
  version: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  optimisticConcurrency: true,
  versionKey: 'version'
});

// Virtual for age
patientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const month = today.getMonth() - birthDate.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Virtual for full name
patientSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for BMI calculation
patientSchema.virtual('bmi').get(function() {
  if (this.vitalSigns && this.vitalSigns.height && this.vitalSigns.weight) {
    const heightInMeters = this.vitalSigns.height / 100;
    return (this.vitalSigns.weight / (heightInMeters * heightInMeters)).toFixed(2);
  }
  return null;
});

// Indexes
patientSchema.index({ patientId: 1 }, { unique: true, sparse: true });
patientSchema.index({ nationalId: 1 });
patientSchema.index({ 'firstName': 1, 'lastName': 1 });
patientSchema.index({ phoneNumber: 1 });
patientSchema.index({ email: 1 });
patientSchema.index({ createdAt: -1 });
patientSchema.index({ status: 1 });

// Legacy integration indexes
patientSchema.index({ legacyId: 1 }, { sparse: true });
patientSchema.index({ legacyPatientNumber: 1 }, { sparse: true });
patientSchema.index({ 'folderIds.folderId': 1 });
patientSchema.index({ 'folderIds.deviceType': 1, 'folderIds.folderId': 1 });

// Performance compound indexes for common queries
patientSchema.index({ status: 1, lastName: 1, firstName: 1 }); // Patient listing by status
patientSchema.index({ status: 1, createdAt: -1 }); // Recent patients by status
patientSchema.index({ lastVisit: -1, status: 1 }); // Recent visit reports
patientSchema.index({ 'insurance.provider': 1, status: 1 }); // Insurance-based queries
patientSchema.index({ 'convention.company': 1, status: 1 }); // Convention/company-based queries
patientSchema.index({ 'convention.company': 1, 'convention.status': 1 }); // Active convention members
patientSchema.index({ 'convention.employeeId': 1 }); // Employee ID lookup
patientSchema.index({ registrationDate: -1, status: 1 }); // Registration reports

// Financial/Balance indexes for billing queries
patientSchema.index({ 'accountBalance.outstanding': -1, status: 1 }); // Outstanding balance reports
patientSchema.index({ 'accountBalance.overdueAmount': -1, status: 1 }); // Overdue balance reports
patientSchema.index({ 'accountBalance.lastUpdated': -1 }); // Balance update tracking

// Multi-clinic indexes for data isolation
patientSchema.index({ homeClinic: 1, createdAt: -1 }); // Patients by clinic sorted by creation date
patientSchema.index({ homeClinic: 1, status: 1, lastName: 1 }); // Clinic patient listing

// Text search index for patient lookup
patientSchema.index({ lastName: 'text', firstName: 'text', patientId: 'text' }, {
  weights: { patientId: 10, lastName: 5, firstName: 3 },
  name: 'patient_text_search'
});

// =====================================================
// SOFT DELETE MIDDLEWARE
// Automatically filter out deleted patients from queries
// =====================================================

// Apply soft delete filter to all find queries
patientSchema.pre('find', function() {
  // Only apply if not explicitly requesting deleted records
  if (!this.getQuery().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
  // Remove the helper field from query
  delete this.getQuery().includeDeleted;
});

patientSchema.pre('findOne', function() {
  if (!this.getQuery().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
  delete this.getQuery().includeDeleted;
});

patientSchema.pre('countDocuments', function() {
  if (!this.getQuery().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
  delete this.getQuery().includeDeleted;
});

patientSchema.pre('findOneAndUpdate', function() {
  if (!this.getQuery().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
  delete this.getQuery().includeDeleted;
});

// =====================================================
// SOFT DELETE METHODS
// =====================================================

/**
 * Soft delete a patient and cascade to related records
 * @param {ObjectId} deletedBy - User performing the deletion
 * @param {String} reason - Reason for deletion
 * @returns {Promise} Deletion result with cascade counts
 */
patientSchema.methods.softDelete = async function(deletedBy, reason = null) {
  const mongoose = require('mongoose');
  const patientId = this._id;

  // Mark patient as deleted
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.deletionReason = reason;
  this.status = 'inactive';

  // CRITICAL: Clear biometric data for privacy/GDPR compliance
  // Face encodings must be removed when patient is deleted
  if (this.biometric) {
    this.biometric.faceEncoding = null;
    this.biometric.faceEncodingVersion = null;
    console.log(`[PATIENT-DELETE] Cleared biometric data for patient ${this.patientId}`);
  }

  await this.save({ validateBeforeSave: false });

  // Cascade soft-delete to related collections
  const cascadeResults = {
    patient: 1,
    appointments: 0,
    prescriptions: 0,
    visits: 0,
    ophthalmologyExams: 0,
    invoices: 0,
    documents: 0,
    laboratoryTests: 0,
    consultationSessions: 0
  };

  try {
    // Cancel future appointments
    const Appointment = mongoose.model('Appointment');
    const appointmentResult = await Appointment.updateMany(
      {
        patient: patientId,
        date: { $gte: new Date() },
        status: { $nin: ['completed', 'cancelled'] }
      },
      {
        $set: {
          status: 'cancelled',
          cancellation: {
            cancelledAt: new Date(),
            cancelledBy: deletedBy,
            reason: 'Patient record deleted',
            systemGenerated: true
          }
        }
      }
    );
    cascadeResults.appointments = appointmentResult.modifiedCount;

    // Soft-mark prescriptions (don't delete medical history)
    const Prescription = mongoose.model('Prescription');
    const prescriptionResult = await Prescription.updateMany(
      { patient: patientId },
      {
        $set: {
          'metadata.patientDeleted': true,
          'metadata.patientDeletedAt': new Date()
        }
      }
    );
    cascadeResults.prescriptions = prescriptionResult.modifiedCount;

    // Mark visits with patient deletion flag
    const Visit = mongoose.model('Visit');
    const visitResult = await Visit.updateMany(
      { patient: patientId },
      {
        $set: {
          'metadata.patientDeleted': true,
          'metadata.patientDeletedAt': new Date()
        }
      }
    );
    cascadeResults.visits = visitResult.modifiedCount;

    // Mark ophthalmology exams
    try {
      const OphthalmologyExam = mongoose.model('OphthalmologyExam');
      const examResult = await OphthalmologyExam.updateMany(
        { patient: patientId },
        {
          $set: {
            'metadata.patientDeleted': true,
            'metadata.patientDeletedAt': new Date()
          }
        }
      );
      cascadeResults.ophthalmologyExams = examResult.modifiedCount;
    } catch (e) {
      log.debug('Suppressed error', { error: e.message });
    }

    // Mark invoices - don't delete for financial records
    const Invoice = mongoose.model('Invoice');
    const invoiceResult = await Invoice.updateMany(
      { patient: patientId },
      {
        $set: {
          'metadata.patientDeleted': true,
          'metadata.patientDeletedAt': new Date()
        }
      }
    );
    cascadeResults.invoices = invoiceResult.modifiedCount;

    // Mark documents
    try {
      const Document = mongoose.model('Document');
      const docResult = await Document.updateMany(
        { patient: patientId },
        {
          $set: {
            'metadata.patientDeleted': true,
            'metadata.patientDeletedAt': new Date()
          }
        }
      );
      cascadeResults.documents = docResult.modifiedCount;
    } catch (e) {
      log.debug('Suppressed error', { error: e.message });
    }

    // Mark consultation sessions
    try {
      const ConsultationSession = mongoose.model('ConsultationSession');
      const sessionResult = await ConsultationSession.updateMany(
        { patient: patientId },
        {
          $set: {
            'metadata.patientDeleted': true,
            'metadata.patientDeletedAt': new Date()
          }
        }
      );
      cascadeResults.consultationSessions = sessionResult.modifiedCount;
    } catch (e) {
      log.debug('Suppressed error', { error: e.message });
    }

  } catch (cascadeError) {
    console.error('Error during cascade soft-delete:', cascadeError);
    // Log but don't fail - patient is already marked deleted
  }

  console.log(`[SOFT DELETE] Patient ${this.patientId} deleted by user ${deletedBy}. Cascade results:`, cascadeResults);

  return {
    success: true,
    patientId: this.patientId,
    deletedAt: this.deletedAt,
    cascadeResults
  };
};

/**
 * Restore a soft-deleted patient
 * @param {ObjectId} restoredBy - User performing the restoration
 * @returns {Promise} Restoration result
 */
patientSchema.methods.restore = async function(restoredBy) {
  if (!this.isDeleted) {
    throw new Error('Patient is not deleted');
  }

  const previousDeletionInfo = {
    deletedAt: this.deletedAt,
    deletedBy: this.deletedBy,
    deletionReason: this.deletionReason
  };

  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  this.deletionReason = null;
  this.status = 'active';

  // Track restoration in notes
  this.notes.push({
    content: `Patient restored by user. Previously deleted at ${previousDeletionInfo.deletedAt?.toISOString()}. Reason: ${previousDeletionInfo.deletionReason || 'Not specified'}`,
    category: 'system',
    createdAt: new Date(),
    createdBy: restoredBy,
    isPrivate: true
  });

  await this.save({ validateBeforeSave: false });

  console.log(`[RESTORE] Patient ${this.patientId} restored by user ${restoredBy}`);

  return {
    success: true,
    patientId: this.patientId,
    restoredAt: new Date(),
    previousDeletionInfo
  };
};

/**
 * Static method to find deleted patients (for admin restore functionality)
 */
patientSchema.statics.findDeleted = function(query = {}) {
  return this.find({ ...query, isDeleted: true, includeDeleted: true });
};

/**
 * Static method to find patients by company/convention
 */
patientSchema.statics.getByCompany = function(companyId, options = {}) {
  const { includeInactive = false, limit = 100, skip = 0 } = options;

  const query = {
    'convention.company': companyId,
    status: 'active',
    isDeleted: { $ne: true }
  };

  if (!includeInactive) {
    query['convention.status'] = 'active';
  }

  return this.find(query)
    .select('patientId firstName lastName dateOfBirth gender phoneNumber convention')
    .sort({ lastName: 1, firstName: 1 })
    .skip(skip)
    .limit(limit);
};

/**
 * Static method to count patients by company
 */
patientSchema.statics.countByCompany = function(companyId, activeOnly = true) {
  const query = {
    'convention.company': companyId,
    status: 'active',
    isDeleted: { $ne: true }
  };

  if (activeOnly) {
    query['convention.status'] = 'active';
  }

  return this.countDocuments(query);
};

/**
 * Static method to check if patient has active convention
 */
patientSchema.statics.hasActiveConvention = async function(patientId) {
  const patient = await this.findById(patientId)
    .select('convention')
    .populate('convention.company', 'name companyId contract.status defaultCoverage');

  if (!patient || !patient.convention?.company) {
    return { hasConvention: false };
  }

  const convention = patient.convention;
  const company = convention.company;

  // Check if company contract is active
  if (company.contract?.status !== 'active') {
    return {
      hasConvention: false,
      reason: 'Contrat entreprise non actif'
    };
  }

  // Check if patient's convention is active
  if (convention.status !== 'active') {
    return {
      hasConvention: false,
      reason: 'Convention patient non active'
    };
  }

  // Check validity dates
  const now = new Date();
  if (convention.validUntil && new Date(convention.validUntil) < now) {
    return {
      hasConvention: false,
      reason: 'Convention expirée'
    };
  }

  if (convention.validFrom && new Date(convention.validFrom) > now) {
    return {
      hasConvention: false,
      reason: 'Convention pas encore active'
    };
  }

  return {
    hasConvention: true,
    company: {
      id: company._id,
      companyId: company.companyId,
      name: company.name
    },
    coveragePercentage: convention.coveragePercentage || company.defaultCoverage?.percentage || 100,
    employeeId: convention.employeeId,
    beneficiaryType: convention.beneficiaryType
  };
};

/**
 * Static method to update annual usage for convention patient
 */
patientSchema.statics.updateConventionUsage = async function(patientId, billedAmount, coveredAmount) {
  const currentYear = new Date().getFullYear();

  const patient = await this.findById(patientId);
  if (!patient || !patient.convention?.company) {
    return null;
  }

  // Reset if new year
  if (patient.convention.annualUsage?.year !== currentYear) {
    patient.convention.annualUsage = {
      year: currentYear,
      totalBilled: 0,
      totalCovered: 0,
      visitCount: 0
    };
  }

  patient.convention.annualUsage.totalBilled += billedAmount;
  patient.convention.annualUsage.totalCovered += coveredAmount;
  patient.convention.annualUsage.visitCount += 1;

  await patient.save();
  return patient.convention.annualUsage;
};

// CRITICAL: Validate dates to prevent future dates
patientSchema.pre('save', function(next) {
  const now = new Date();

  // Date of birth cannot be in the future
  if (this.dateOfBirth && new Date(this.dateOfBirth) > now) {
    const error = new Error('Date of birth cannot be in the future');
    error.name = 'ValidationError';
    error.statusCode = 400;
    return next(error);
  }

  // Patient must be born (date of birth must be before today)
  // Also reasonable age check - patient must be less than 150 years old
  if (this.dateOfBirth) {
    const dob = new Date(this.dateOfBirth);
    const age = Math.floor((now - dob) / (365.25 * 24 * 60 * 60 * 1000));

    if (age < 0) {
      const error = new Error('Invalid date of birth');
      error.name = 'ValidationError';
      error.statusCode = 400;
      return next(error);
    }

    if (age > 150) {
      const error = new Error('Date of birth indicates age over 150 years - please verify');
      error.name = 'ValidationError';
      error.statusCode = 400;
      return next(error);
    }
  }

  // Registration date should not be in the future
  if (this.registrationDate && new Date(this.registrationDate) > now) {
    const error = new Error('Registration date cannot be in the future');
    error.name = 'ValidationError';
    error.statusCode = 400;
    return next(error);
  }

  next();
});

// Generate patient ID
patientSchema.pre('save', async function(next) {
  if (!this.patientId) {
    const year = new Date().getFullYear();
    const counterId = `patient-${year}`;
    const sequence = await Counter.getNextSequence(counterId);
    this.patientId = `PAT${year}${String(sequence).padStart(6, '0')}`;
  }
  next();
});

// Update BMI when weight or height changes
patientSchema.pre('save', function(next) {
  if (this.vitalSigns && this.vitalSigns.height && this.vitalSigns.weight) {
    const heightInMeters = this.vitalSigns.height / 100;
    this.vitalSigns.bmi = (this.vitalSigns.weight / (heightInMeters * heightInMeters)).toFixed(2);
    this.vitalSigns.lastUpdated = new Date();
  }
  next();
});

// CRITICAL: Static method to check for duplicate patients
patientSchema.statics.checkForDuplicates = async function(patientData, excludeId = null) {
  const duplicates = [];

  // 1. Check for exact match on unique identifiers
  // CRITICAL FIX: Exclude deleted patients from duplicate detection
  // Otherwise, deleted patient data blocks new patient registration
  const query = {
    _id: { $ne: excludeId }, // Exclude current patient if updating
    isDeleted: { $ne: true } // Exclude soft-deleted patients
  };

  // Check national ID (should be unique)
  if (patientData.nationalId) {
    const nationalIdMatch = await this.findOne({
      ...query,
      nationalId: patientData.nationalId
    }).select('patientId firstName lastName dateOfBirth phoneNumber nationalId');

    if (nationalIdMatch) {
      duplicates.push({
        type: 'exact',
        field: 'nationalId',
        confidence: 100,
        patient: nationalIdMatch,
        message: 'National ID already exists in system'
      });
    }
  }

  // Check phone number
  if (patientData.phoneNumber) {
    const phoneMatch = await this.findOne({
      ...query,
      phoneNumber: patientData.phoneNumber
    }).select('patientId firstName lastName dateOfBirth phoneNumber');

    if (phoneMatch) {
      duplicates.push({
        type: 'exact',
        field: 'phoneNumber',
        confidence: 95,
        patient: phoneMatch,
        message: 'Phone number already exists in system'
      });
    }
  }

  // Check email
  if (patientData.email) {
    const emailMatch = await this.findOne({
      ...query,
      email: patientData.email
    }).select('patientId firstName lastName dateOfBirth email');

    if (emailMatch) {
      duplicates.push({
        type: 'exact',
        field: 'email',
        confidence: 90,
        patient: emailMatch,
        message: 'Email already exists in system'
      });
    }
  }

  // 2. Check for fuzzy match on name + DOB (potential duplicate)
  if (patientData.firstName && patientData.lastName && patientData.dateOfBirth) {
    // Normalize names for comparison (case-insensitive, trim whitespace)
    const firstNameNorm = patientData.firstName.trim().toLowerCase();
    const lastNameNorm = patientData.lastName.trim().toLowerCase();

    const nameDobMatches = await this.find({
      ...query,
      firstName: new RegExp(`^${firstNameNorm}$`, 'i'),
      lastName: new RegExp(`^${lastNameNorm}$`, 'i'),
      dateOfBirth: patientData.dateOfBirth
    }).select('patientId firstName lastName dateOfBirth phoneNumber email').limit(5);

    for (const match of nameDobMatches) {
      // Check if not already in duplicates array
      const alreadyFound = duplicates.some(d => d.patient._id.toString() === match._id.toString());
      if (!alreadyFound) {
        duplicates.push({
          type: 'fuzzy',
          field: 'name_dob',
          confidence: 85,
          patient: match,
          message: 'Patient with same name and date of birth already exists'
        });
      }
    }
  }

  // 3. Check for similar names with same DOB (close match)
  if (patientData.firstName && patientData.lastName && patientData.dateOfBirth) {
    const firstNamePattern = patientData.firstName.trim().toLowerCase();
    const lastNamePattern = patientData.lastName.trim().toLowerCase();

    // Find patients with similar names (first 3 chars match) and same DOB
    if (firstNamePattern.length >= 3 && lastNamePattern.length >= 3) {
      const similarMatches = await this.find({
        ...query,
        firstName: new RegExp(`^${firstNamePattern.substring(0, 3)}`, 'i'),
        lastName: new RegExp(`^${lastNamePattern.substring(0, 3)}`, 'i'),
        dateOfBirth: patientData.dateOfBirth
      }).select('patientId firstName lastName dateOfBirth phoneNumber').limit(5);

      for (const match of similarMatches) {
        const alreadyFound = duplicates.some(d => d.patient._id.toString() === match._id.toString());
        if (!alreadyFound) {
          duplicates.push({
            type: 'similar',
            field: 'similar_name_dob',
            confidence: 70,
            patient: match,
            message: 'Patient with similar name and same date of birth found'
          });
        }
      }
    }
  }

  return duplicates;
};

// CRITICAL: Pre-save middleware to prevent duplicate patient creation
patientSchema.pre('save', async function(next) {
  // Only check for duplicates on new patient creation (not on updates)
  if (!this.isNew) {
    return next();
  }

  try {
    const duplicates = await this.constructor.checkForDuplicates({
      nationalId: this.nationalId,
      phoneNumber: this.phoneNumber,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      dateOfBirth: this.dateOfBirth
    }, this._id);

    // If we found high-confidence duplicates (exact matches), prevent creation
    const exactDuplicates = duplicates.filter(d => d.type === 'exact');

    if (exactDuplicates.length > 0) {
      const duplicate = exactDuplicates[0];
      const error = new Error(`Duplicate patient detected: ${duplicate.message}`);
      error.name = 'DuplicatePatientError';
      error.duplicates = exactDuplicates;
      error.statusCode = 409; // Conflict
      return next(error);
    }

    // If we found fuzzy duplicates, store them in a property for the controller to handle
    if (duplicates.length > 0) {
      this._potentialDuplicates = duplicates;
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Method to recalculate and update account balance
patientSchema.methods.updateAccountBalance = async function() {
  const Invoice = require('./Invoice');

  // Get all non-cancelled invoices for this patient
  const invoices = await Invoice.find({
    patient: this._id,
    status: { $nin: ['cancelled', 'voided'] }
  });

  const now = new Date();
  let totalBilled = 0;
  let totalPaid = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let lastPaymentDate = null;
  let lastPaymentAmount = 0;
  let paymentCount = 0;

  for (const invoice of invoices) {
    totalBilled += invoice.summary?.total || 0;
    totalPaid += invoice.summary?.amountPaid || 0;

    // Check if overdue
    const isOverdue = invoice.dueDate &&
      new Date(invoice.dueDate) < now &&
      (invoice.summary?.amountDue || 0) > 0 &&
      ['issued', 'sent', 'viewed', 'partial'].includes(invoice.status);

    if (isOverdue) {
      overdueCount++;
      overdueAmount += invoice.summary?.amountDue || 0;
    }

    // Track payment history
    if (invoice.payments && invoice.payments.length > 0) {
      for (const payment of invoice.payments) {
        paymentCount++;
        if (!lastPaymentDate || new Date(payment.date) > new Date(lastPaymentDate)) {
          lastPaymentDate = payment.date;
          lastPaymentAmount = payment.amount;
        }
      }
    }
  }

  // Update account balance
  this.accountBalance = {
    totalBilled,
    totalPaid,
    outstanding: totalBilled - totalPaid,
    overdueCount,
    overdueAmount,
    credit: this.accountBalance?.credit || 0, // Preserve existing credit
    lastUpdated: now,
    paymentHistory: {
      lastPaymentDate,
      lastPaymentAmount,
      paymentCount
    }
  };

  await this.save({ validateBeforeSave: false });

  return this.accountBalance;
};

// Static method to update balance for a patient by ID
patientSchema.statics.updatePatientBalance = async function(patientId) {
  const patient = await this.findById(patientId);
  if (!patient) {
    throw new Error('Patient not found');
  }
  return patient.updateAccountBalance();
};

// Static method to get patients with outstanding balances
patientSchema.statics.getPatientsWithOutstandingBalance = async function(options = {}) {
  const { minAmount = 0, limit = 50, sortBy = 'outstanding' } = options;

  const sortOptions = {
    outstanding: { 'accountBalance.outstanding': -1 },
    overdue: { 'accountBalance.overdueAmount': -1 },
    lastPayment: { 'accountBalance.paymentHistory.lastPaymentDate': 1 }
  };

  return this.find({
    status: 'active',
    'accountBalance.outstanding': { $gt: minAmount }
  })
    .select('patientId firstName lastName phoneNumber email accountBalance')
    .sort(sortOptions[sortBy] || sortOptions.outstanding)
    .limit(limit);
};

// Static method to add credit to patient account (for prepayments, refunds, etc.)
patientSchema.statics.addCredit = async function(patientId, amount, reason, userId) {
  const patient = await this.findById(patientId);
  if (!patient) {
    throw new Error('Patient not found');
  }

  if (!patient.accountBalance) {
    patient.accountBalance = {};
  }

  patient.accountBalance.credit = (patient.accountBalance.credit || 0) + amount;
  patient.accountBalance.lastUpdated = new Date();

  // Log credit addition to audit log
  try {
    const AuditLog = require('./AuditLog');
    await AuditLog.create({
      user: userId,
      action: 'PATIENT_CREDIT_ADD',
      resource: `/api/patients/${patientId}/credit`,
      metadata: {
        patientId: patient.patientId,
        amount,
        reason,
        newBalance: patient.accountBalance.credit
      }
    });
  } catch (err) {
    console.error('Failed to log credit addition:', err.message);
  }

  await patient.save({ validateBeforeSave: false });
  return patient.accountBalance;
};

// Static method to use credit from patient account to pay invoice
patientSchema.statics.useCredit = async function(patientId, amount, invoiceId, userId) {
  const patient = await this.findById(patientId);
  if (!patient) {
    throw new Error('Patient not found');
  }

  const availableCredit = patient.accountBalance?.credit || 0;
  if (availableCredit <= 0) {
    throw new Error('No credit available');
  }

  const amountToUse = Math.min(amount, availableCredit);

  patient.accountBalance.credit = availableCredit - amountToUse;
  patient.accountBalance.lastUpdated = new Date();

  // Log credit usage to audit log
  try {
    const AuditLog = require('./AuditLog');
    await AuditLog.create({
      user: userId,
      action: 'PATIENT_CREDIT_USE',
      resource: `/api/patients/${patientId}/credit/use`,
      metadata: {
        patientId: patient.patientId,
        amountUsed: amountToUse,
        invoiceId,
        remainingCredit: patient.accountBalance.credit
      }
    });
  } catch (err) {
    console.error('Failed to log credit usage:', err.message);
  }

  await patient.save({ validateBeforeSave: false });
  return { amountUsed: amountToUse, remainingCredit: patient.accountBalance.credit };
};

// Static method to get patient credit balance
patientSchema.statics.getCreditBalance = async function(patientId) {
  const patient = await this.findById(patientId).select('accountBalance patientId firstName lastName');
  if (!patient) {
    throw new Error('Patient not found');
  }
  return {
    patientId: patient.patientId,
    name: `${patient.firstName} ${patient.lastName}`,
    credit: patient.accountBalance?.credit || 0,
    lastUpdated: patient.accountBalance?.lastUpdated
  };
};

// Static method to apply credit to an invoice
patientSchema.statics.applyCreditToInvoice = async function(patientId, invoiceId, amount, userId) {
  const Invoice = require('./Invoice');
  const patient = await this.findById(patientId);

  if (!patient) {
    throw new Error('Patient not found');
  }

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  if (invoice.patient.toString() !== patientId.toString()) {
    throw new Error('Invoice does not belong to this patient');
  }

  if (invoice.summary.amountDue <= 0) {
    throw new Error('Invoice is already paid');
  }

  const availableCredit = patient.accountBalance?.credit || 0;
  if (availableCredit <= 0) {
    throw new Error('No credit available');
  }

  // Calculate how much credit to apply
  const maxApplicable = Math.min(amount || availableCredit, invoice.summary.amountDue, availableCredit);

  // Use credit from patient account
  const creditResult = await this.useCredit(patientId, maxApplicable, invoiceId, userId);

  // Add payment to invoice
  const crypto = require('crypto');
  const paymentId = `CRD${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  invoice.payments.push({
    paymentId,
    amount: creditResult.amountUsed,
    currency: process.env.BASE_CURRENCY || 'CDF',
    amountInBaseCurrency: creditResult.amountUsed,
    exchangeRate: 1,
    method: 'other',
    date: new Date(),
    reference: 'Credit balance applied',
    notes: 'Applied from patient credit balance',
    receivedBy: userId
  });

  invoice.updatedBy = userId;
  await invoice.save();

  return {
    amountApplied: creditResult.amountUsed,
    remainingCredit: creditResult.remainingCredit,
    invoiceAmountDue: invoice.summary.amountDue,
    invoiceStatus: invoice.status
  };
};

// Virtual to check if patient has outstanding balance
patientSchema.virtual('hasOutstandingBalance').get(function() {
  return (this.accountBalance?.outstanding || 0) > 0;
});

// Virtual to check if patient has overdue invoices
patientSchema.virtual('hasOverdueInvoices').get(function() {
  return (this.accountBalance?.overdueCount || 0) > 0;
});

// =============================================
// STORED PAYMENT METHODS MANAGEMENT
// =============================================

// Method to add a stored payment method
patientSchema.methods.addPaymentMethod = async function(paymentMethodData, userId) {
  const crypto = require('crypto');

  if (!this.storedPaymentMethods) {
    this.storedPaymentMethods = [];
  }

  // If this is set as default, unset other defaults
  if (paymentMethodData.isDefault) {
    this.storedPaymentMethods.forEach(pm => {
      pm.isDefault = false;
    });
  }

  // If this is the first payment method, make it default
  if (this.storedPaymentMethods.length === 0) {
    paymentMethodData.isDefault = true;
  }

  const newPaymentMethod = {
    id: crypto.randomBytes(8).toString('hex'),
    type: paymentMethodData.type,
    nickname: paymentMethodData.nickname,
    last4: paymentMethodData.last4,
    brand: paymentMethodData.brand,
    expiryMonth: paymentMethodData.expiryMonth,
    expiryYear: paymentMethodData.expiryYear,
    phoneNumber: paymentMethodData.phoneNumber,
    phoneNumberLast4: paymentMethodData.phoneNumber?.slice(-4),
    stripePaymentMethodId: paymentMethodData.stripePaymentMethodId,
    stripeCustomerId: paymentMethodData.stripeCustomerId,
    bankName: paymentMethodData.bankName,
    accountNumberLast4: paymentMethodData.accountNumberLast4,
    isDefault: paymentMethodData.isDefault || false,
    isActive: true,
    verified: paymentMethodData.verified || false,
    verifiedAt: paymentMethodData.verified ? new Date() : null,
    billingAddress: paymentMethodData.billingAddress,
    addedAt: new Date(),
    addedBy: userId,
    usageCount: 0
  };

  this.storedPaymentMethods.push(newPaymentMethod);
  await this.save({ validateBeforeSave: false });

  // Log the addition
  try {
    const AuditLog = require('./AuditLog');
    await AuditLog.create({
      user: userId,
      action: 'PAYMENT_METHOD_ADD',
      resource: `/api/patients/${this._id}/payment-methods`,
      metadata: {
        patientId: this.patientId,
        paymentMethodId: newPaymentMethod.id,
        type: newPaymentMethod.type,
        last4: newPaymentMethod.last4 || newPaymentMethod.phoneNumberLast4
      }
    });
  } catch (err) {
    console.error('Failed to log payment method addition:', err.message);
  }

  return newPaymentMethod;
};

// Method to remove a stored payment method
patientSchema.methods.removePaymentMethod = async function(paymentMethodId, userId) {
  const pmIndex = this.storedPaymentMethods.findIndex(
    pm => pm.id === paymentMethodId || pm._id?.toString() === paymentMethodId
  );

  if (pmIndex === -1) {
    throw new Error('Payment method not found');
  }

  const removed = this.storedPaymentMethods[pmIndex];
  this.storedPaymentMethods.splice(pmIndex, 1);

  // If we removed the default, set a new default
  if (removed.isDefault && this.storedPaymentMethods.length > 0) {
    this.storedPaymentMethods[0].isDefault = true;
  }

  await this.save({ validateBeforeSave: false });

  // Log the removal
  try {
    const AuditLog = require('./AuditLog');
    await AuditLog.create({
      user: userId,
      action: 'PAYMENT_METHOD_REMOVE',
      resource: `/api/patients/${this._id}/payment-methods/${paymentMethodId}`,
      metadata: {
        patientId: this.patientId,
        paymentMethodId: removed.id,
        type: removed.type
      }
    });
  } catch (err) {
    console.error('Failed to log payment method removal:', err.message);
  }

  return { success: true, removed };
};

// Method to set default payment method
patientSchema.methods.setDefaultPaymentMethod = async function(paymentMethodId, userId) {
  const pm = this.storedPaymentMethods.find(
    pm => pm.id === paymentMethodId || pm._id?.toString() === paymentMethodId
  );

  if (!pm) {
    throw new Error('Payment method not found');
  }

  // Unset all defaults and set new one
  this.storedPaymentMethods.forEach(p => {
    p.isDefault = false;
  });
  pm.isDefault = true;

  await this.save({ validateBeforeSave: false });
  return pm;
};

// Method to record payment method usage
patientSchema.methods.recordPaymentMethodUsage = async function(paymentMethodId) {
  const pm = this.storedPaymentMethods.find(
    pm => pm.id === paymentMethodId || pm._id?.toString() === paymentMethodId
  );

  if (pm) {
    pm.lastUsedAt = new Date();
    pm.usageCount = (pm.usageCount || 0) + 1;
    await this.save({ validateBeforeSave: false });
  }
};

// Static method to get a patient's payment methods (masked for security)
patientSchema.statics.getPaymentMethods = async function(patientId) {
  const patient = await this.findById(patientId).select('storedPaymentMethods patientId firstName lastName');
  if (!patient) {
    throw new Error('Patient not found');
  }

  return {
    patientId: patient.patientId,
    name: `${patient.firstName} ${patient.lastName}`,
    paymentMethods: (patient.storedPaymentMethods || [])
      .filter(pm => pm.isActive)
      .map(pm => ({
        id: pm.id || pm._id,
        type: pm.type,
        nickname: pm.nickname,
        last4: pm.last4 || pm.phoneNumberLast4,
        brand: pm.brand,
        expiryMonth: pm.expiryMonth,
        expiryYear: pm.expiryYear,
        bankName: pm.bankName,
        isDefault: pm.isDefault,
        verified: pm.verified,
        addedAt: pm.addedAt,
        lastUsedAt: pm.lastUsedAt,
        usageCount: pm.usageCount
      }))
  };
};

// Static method to get a specific payment method for charging (includes sensitive data)
patientSchema.statics.getPaymentMethodForCharge = async function(patientId, paymentMethodId) {
  const patient = await this.findById(patientId).select('storedPaymentMethods');
  if (!patient) {
    throw new Error('Patient not found');
  }

  const pm = patient.storedPaymentMethods.find(
    p => (p.id === paymentMethodId || p._id?.toString() === paymentMethodId) && p.isActive
  );

  if (!pm) {
    throw new Error('Payment method not found or inactive');
  }

  return pm;
};

// =====================================================
// PATIENT ALERTS MANAGEMENT
// StudioVision Parity: Alert banner system
// =====================================================

// Add an alert to patient
patientSchema.methods.addAlert = async function(alertData, userId) {
  if (!this.patientAlerts) {
    this.patientAlerts = [];
  }

  const newAlert = {
    type: alertData.type,
    message: alertData.message,
    messageFr: alertData.messageFr,
    details: alertData.details,
    sourceType: alertData.sourceType || 'manual',
    sourceId: alertData.sourceId,
    sourceModel: alertData.sourceModel,
    autoGenerated: alertData.autoGenerated || false,
    priority: alertData.priority || 0,
    expiresAt: alertData.expiresAt,
    showOnDashboard: alertData.showOnDashboard !== false,
    createdAt: new Date(),
    createdBy: userId
  };

  this.patientAlerts.push(newAlert);
  await this.save({ validateBeforeSave: false });

  return this.patientAlerts[this.patientAlerts.length - 1];
};

// Dismiss an alert
patientSchema.methods.dismissAlert = async function(alertId, userId) {
  const alert = this.patientAlerts.id(alertId);
  if (!alert) {
    throw new Error('Alert not found');
  }

  alert.dismissedAt = new Date();
  alert.dismissedBy = userId;
  alert.showOnDashboard = false;

  await this.save({ validateBeforeSave: false });
  return alert;
};

// Acknowledge an alert (mark as seen but don't dismiss)
patientSchema.methods.acknowledgeAlert = async function(alertId, userId) {
  const alert = this.patientAlerts.id(alertId);
  if (!alert) {
    throw new Error('Alert not found');
  }

  alert.acknowledgedAt = new Date();
  alert.acknowledgedBy = userId;

  await this.save({ validateBeforeSave: false });
  return alert;
};

// Get active alerts (not dismissed, not expired)
patientSchema.methods.getActiveAlerts = function() {
  const now = new Date();
  return (this.patientAlerts || [])
    .filter(alert =>
      !alert.dismissedAt &&
      alert.showOnDashboard &&
      (!alert.expiresAt || new Date(alert.expiresAt) > now)
    )
    .sort((a, b) => b.priority - a.priority);
};

// Remove expired alerts
patientSchema.methods.cleanupExpiredAlerts = async function() {
  const now = new Date();
  const originalCount = this.patientAlerts?.length || 0;

  this.patientAlerts = (this.patientAlerts || []).filter(
    alert => !alert.expiresAt || new Date(alert.expiresAt) > now
  );

  if (this.patientAlerts.length < originalCount) {
    await this.save({ validateBeforeSave: false });
  }

  return originalCount - this.patientAlerts.length;
};

// Add allergy alert automatically from medicalHistory
patientSchema.methods.syncAllergyAlerts = async function(userId) {
  // Remove existing allergy alerts
  this.patientAlerts = (this.patientAlerts || []).filter(
    a => a.sourceType !== 'allergy'
  );

  // Create alerts from current allergies
  const allergies = this.medicalHistory?.allergies || [];
  for (const allergy of allergies) {
    if (allergy.allergen) {
      this.patientAlerts.push({
        type: allergy.severity === 'severe' ? 'urgent' : 'allergy',
        message: `Allergy: ${allergy.allergen}`,
        messageFr: `Allergie: ${allergy.allergen}`,
        details: allergy.reaction,
        sourceType: 'allergy',
        autoGenerated: true,
        priority: allergy.severity === 'severe' ? 100 : 50,
        showOnDashboard: true,
        createdAt: new Date(),
        createdBy: userId
      });
    }
  }

  await this.save({ validateBeforeSave: false });
  return this.patientAlerts.filter(a => a.sourceType === 'allergy');
};

// Static method to generate overdue follow-up alerts for all patients
patientSchema.statics.generateOverdueFollowupAlerts = async function(systemUserId) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Find patients who had their last visit more than 30 days ago
  // and have a scheduled follow-up that's past due
  const Appointment = require('./Appointment');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('Patient');

  const overduePatients = await Appointment.find({
    date: { $lt: now },
    status: 'scheduled',
    isFollowUp: true
  }).distinct('patient');

  let alertsCreated = 0;

  for (const patientId of overduePatients) {
    const patient = await this.findById(patientId);
    if (!patient) continue;

    // Check if alert already exists
    const existingAlert = patient.patientAlerts?.find(
      a => a.sourceType === 'overdue_followup' && !a.dismissedAt
    );

    if (!existingAlert) {
      await patient.addAlert({
        type: 'reminder',
        message: 'Overdue follow-up appointment',
        messageFr: 'Rendez-vous de suivi en retard',
        sourceType: 'overdue_followup',
        autoGenerated: true,
        priority: 30
      }, systemUserId);
      alertsCreated++;
    }
  }

  return alertsCreated;
};

// =====================================================
// PHI ENCRYPTION AT REST
// =====================================================
// Apply field-level encryption for sensitive PHI data
// This encrypts data before storing in MongoDB and decrypts on retrieval
// Uses AES-256-GCM authenticated encryption
//
// Encrypted fields:
// - nationalId: Government-issued ID number
// - insurance.policyNumber: Insurance policy number
// - storedPaymentMethods.phoneNumber: Mobile money phone numbers
// - storedPaymentMethods.stripePaymentMethodId: Stripe tokens
// - storedPaymentMethods.stripeCustomerId: Stripe customer IDs
// - phoneNumber / alternativePhone: Contact phone numbers
// - address.street: Street address (most identifying address component)
// - emergencyContact.phone / .name: Emergency contact info
//
// Note: biometric.faceEncoding is already protected via select:false
// and is cleared on patient deletion for GDPR compliance
//
// IMPORTANT: firstName and lastName are NOT encrypted because:
// 1. Encryption would break patient search functionality (encrypted text can't be searched)
// 2. Names are protected via:
//    - Role-based access controls (only authorized staff access patients)
//    - Audit logging of all patient data access
//    - Database-level encryption at rest (MongoDB storage)
// For HIPAA compliance, names should use database-level CSFLE in production.
// =====================================================
patientSchema.plugin(phiEncryptionPlugin, {
  fields: [
    // Identity documents
    'nationalId',

    // Insurance information
    'insurance.policyNumber',

    // Contact information (PHI - HIPAA identifiers)
    'phoneNumber',
    'alternativePhone',
    'address.street',

    // Emergency contact (PHI - can identify patient relationships)
    'emergencyContact.name',
    'emergencyContact.phone',

    // Payment information (PCI-DSS + PHI)
    'storedPaymentMethods.phoneNumber',
    'storedPaymentMethods.stripePaymentMethodId',
    'storedPaymentMethods.stripeCustomerId'
  ],
  // Log encryption operations for audit trail
  logOperations: process.env.NODE_ENV !== 'test'
});

module.exports = mongoose.model('Patient', patientSchema);
