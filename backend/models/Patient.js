const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  // Identification
  patientId: {
    type: String,
    unique: true,
    required: true
  },
  nationalId: {
    type: String,
    unique: true,
    sparse: true
  },

  // Personal Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
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

  // Contact Information
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required']
  },
  alternativePhone: String,
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
      default: 'Morocco'
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
      ageAtDiagnosis: Number
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

  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'deceased', 'transferred'],
    default: 'active'
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

  // Audit
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
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
patientSchema.index({ patientId: 1 });
patientSchema.index({ nationalId: 1 });
patientSchema.index({ 'firstName': 1, 'lastName': 1 });
patientSchema.index({ phoneNumber: 1 });
patientSchema.index({ email: 1 });
patientSchema.index({ createdAt: -1 });
patientSchema.index({ status: 1 });

// Generate patient ID
patientSchema.pre('save', async function(next) {
  if (!this.patientId) {
    const count = await this.constructor.countDocuments();
    const year = new Date().getFullYear();
    this.patientId = `PAT${year}${String(count + 1).padStart(6, '0')}`;
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

module.exports = mongoose.model('Patient', patientSchema);