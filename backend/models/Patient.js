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
patientSchema.index({ patientId: 1 });
patientSchema.index({ nationalId: 1 });
patientSchema.index({ 'firstName': 1, 'lastName': 1 });
patientSchema.index({ phoneNumber: 1 });
patientSchema.index({ email: 1 });
patientSchema.index({ createdAt: -1 });
patientSchema.index({ status: 1 });

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

// CRITICAL: Static method to check for duplicate patients
patientSchema.statics.checkForDuplicates = async function(patientData, excludeId = null) {
  const duplicates = [];

  // 1. Check for exact match on unique identifiers
  const query = { _id: { $ne: excludeId } }; // Exclude current patient if updating

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

module.exports = mongoose.model('Patient', patientSchema);