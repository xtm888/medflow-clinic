const mongoose = require('mongoose');

/**
 * CentralPatient Model
 * Aggregated patient data from all clinics
 * Stores patient index for cross-clinic lookup
 */
const centralPatientSchema = new mongoose.Schema({
  // Original ID from source clinic
  _originalId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },

  // Source clinic that owns this patient record
  _sourceClinic: {
    type: String,
    required: true,
    index: true
  },

  // Sync metadata
  _syncedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  _lastModified: {
    type: Date,
    required: true
  },
  _deleted: {
    type: Boolean,
    default: false,
    index: true
  },
  _deletedAt: Date,
  _version: {
    type: Number,
    default: 1
  },

  // Patient identification
  patientId: {
    type: String,
    required: true,
    index: true
  },
  nationalId: {
    type: String,
    sparse: true,
    index: true
  },

  // Legacy IDs for cross-referencing
  legacyIds: {
    dmi: String,
    dmiEye: String,
    oldEmr: String,
    externalRef: String
  },

  // Personal information
  firstName: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  lastName: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  dateOfBirth: {
    type: Date,
    required: true,
    index: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  bloodType: String,

  // Contact
  contact: {
    phone: { type: String, index: true },
    alternatePhone: String,
    email: String,
    address: {
      street: String,
      city: String,
      province: String,
      country: String
    }
  },

  // Medical summary (for quick lookup)
  medicalSummary: {
    allergies: [String],
    chronicConditions: [String],
    currentMedications: [String],
    bloodType: String
  },

  // Visit summary
  visitSummary: {
    totalVisits: { type: Number, default: 0 },
    lastVisitDate: Date,
    lastVisitClinic: String,
    clinicsVisited: [String]
  },

  // Photo URL (reference, not actual image)
  photoUrl: String,

  // Insurance/Convention
  insurance: {
    hasInsurance: Boolean,
    provider: String,
    policyNumber: String,
    conventionId: mongoose.Schema.Types.ObjectId
  },

  // Registration info
  registeredAtClinic: String,
  registeredAt: Date,

  // Active status
  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient querying
centralPatientSchema.index({ _originalId: 1, _sourceClinic: 1 }, { unique: true });
centralPatientSchema.index({ patientId: 1, _sourceClinic: 1 });
centralPatientSchema.index({ nationalId: 1 }, { sparse: true });
centralPatientSchema.index({ firstName: 1, lastName: 1 });
centralPatientSchema.index({ 'contact.phone': 1 });
centralPatientSchema.index({ _syncedAt: -1 });
centralPatientSchema.index({ _deleted: 1, _sourceClinic: 1 });

// Text index for search
centralPatientSchema.index({
  firstName: 'text',
  lastName: 'text',
  patientId: 'text',
  'contact.phone': 'text'
}, {
  weights: {
    patientId: 10,
    lastName: 5,
    firstName: 5,
    'contact.phone': 3
  }
});

// Virtual: Full name
centralPatientSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual: Age
centralPatientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
});

// Static: Search across all clinics
centralPatientSchema.statics.searchAcrossClinics = async function(searchParams, options = {}) {
  const { excludeClinic, limit = 50 } = options;
  const query = { _deleted: { $ne: true } };

  if (excludeClinic) {
    query._sourceClinic = { $ne: excludeClinic };
  }

  // Build search conditions
  if (searchParams.name) {
    const nameRegex = new RegExp(searchParams.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [
      { firstName: nameRegex },
      { lastName: nameRegex }
    ];
  }

  if (searchParams.patientId) {
    query.patientId = new RegExp(searchParams.patientId, 'i');
  }

  if (searchParams.nationalId) {
    query.nationalId = searchParams.nationalId;
  }

  if (searchParams.phone) {
    query['contact.phone'] = new RegExp(searchParams.phone.replace(/\D/g, ''));
  }

  if (searchParams.dob) {
    query.dateOfBirth = new Date(searchParams.dob);
  }

  // Group by unique patient (nationalId or patientId + DOB)
  const patients = await this.aggregate([
    { $match: query },
    { $sort: { _syncedAt: -1 } },
    {
      $group: {
        _id: {
          // Group by nationalId if available, else by name+dob
          $cond: [
            { $ne: ['$nationalId', null] },
            '$nationalId',
            { $concat: ['$firstName', '-', '$lastName', '-', { $toString: '$dateOfBirth' }] }
          ]
        },
        patient: { $first: '$$ROOT' },
        clinics: { $addToSet: '$_sourceClinic' },
        latestVisit: { $max: '$visitSummary.lastVisitDate' }
      }
    },
    { $limit: limit },
    {
      $project: {
        _id: '$patient._id',
        _originalId: '$patient._originalId',
        _sourceClinic: '$patient._sourceClinic',
        patientId: '$patient.patientId',
        nationalId: '$patient.nationalId',
        firstName: '$patient.firstName',
        lastName: '$patient.lastName',
        dateOfBirth: '$patient.dateOfBirth',
        gender: '$patient.gender',
        contact: '$patient.contact',
        availableAtClinics: '$clinics',
        lastVisit: '$latestVisit'
      }
    }
  ]);

  return patients;
};

// Static: Upsert from clinic sync
centralPatientSchema.statics.upsertFromSync = async function(clinicId, patientData) {
  const { _id, ...data } = patientData;

  return this.findOneAndUpdate(
    { _originalId: _id, _sourceClinic: clinicId },
    {
      $set: {
        ...data,
        _originalId: _id,
        _sourceClinic: clinicId,
        _syncedAt: new Date(),
        _lastModified: patientData.updatedAt || new Date()
      },
      $inc: { _version: 1 }
    },
    { upsert: true, new: true }
  );
};

// Static: Get patient with all clinic records
centralPatientSchema.statics.getPatientAllClinics = async function(identifier) {
  const query = {
    _deleted: { $ne: true },
    $or: [
      { patientId: identifier },
      { nationalId: identifier },
      { _originalId: identifier }
    ]
  };

  return this.find(query).sort({ _syncedAt: -1 }).lean();
};

module.exports = mongoose.model('CentralPatient', centralPatientSchema);
