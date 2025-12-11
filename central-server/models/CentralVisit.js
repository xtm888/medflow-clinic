const mongoose = require('mongoose');

/**
 * CentralVisit Model
 * Aggregated visit data from all clinics
 */
const centralVisitSchema = new mongoose.Schema({
  // Original ID from source clinic
  _originalId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },

  // Source clinic
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
  _lastModified: Date,
  _deleted: {
    type: Boolean,
    default: false
  },
  _version: {
    type: Number,
    default: 1
  },

  // Visit identification
  visitNumber: {
    type: String,
    index: true
  },

  // Patient reference
  patient: {
    _id: mongoose.Schema.Types.ObjectId,
    patientId: String,
    name: String
  },

  // Visit date and time
  visitDate: {
    type: Date,
    required: true,
    index: true
  },
  checkInTime: Date,
  checkOutTime: Date,

  // Visit type
  visitType: {
    type: String,
    enum: ['new', 'follow-up', 'emergency', 'routine', 'procedure', 'surgery', 'other'],
    default: 'new',
    index: true
  },

  // Department/Service
  department: {
    type: String,
    enum: ['consultation', 'ophthalmology', 'optometry', 'pharmacy', 'laboratory', 'imaging', 'surgery', 'other'],
    index: true
  },

  // Provider
  provider: {
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    role: String
  },

  // Chief complaint summary
  chiefComplaint: String,

  // Diagnosis summary
  diagnoses: [{
    code: String, // ICD code
    description: String,
    type: { type: String, enum: ['primary', 'secondary'] }
  }],

  // Status
  status: {
    type: String,
    enum: ['scheduled', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled',
    index: true
  },

  // Vitals summary
  vitals: {
    bloodPressure: String,
    pulse: Number,
    temperature: Number,
    weight: Number,
    height: Number
  },

  // Visual acuity (for ophthalmology)
  visualAcuity: {
    od: String,
    os: String
  },

  // Has related records
  hasExam: { type: Boolean, default: false },
  hasPrescription: { type: Boolean, default: false },
  hasLabOrder: { type: Boolean, default: false },
  hasInvoice: { type: Boolean, default: false },

  // Notes (summary only, not full notes)
  notesSummary: String

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes
centralVisitSchema.index({ _originalId: 1, _sourceClinic: 1 }, { unique: true });
centralVisitSchema.index({ 'patient.patientId': 1, visitDate: -1 });
centralVisitSchema.index({ visitDate: -1, _sourceClinic: 1 });
centralVisitSchema.index({ status: 1, visitDate: -1 });
centralVisitSchema.index({ department: 1, visitDate: -1 });

// Static: Get patient visit history across clinics
centralVisitSchema.statics.getPatientHistory = async function(patientId, options = {}) {
  const { limit = 50 } = options;

  return this.find({
    $or: [
      { 'patient.patientId': patientId },
      { 'patient._id': patientId }
    ],
    _deleted: { $ne: true }
  })
    .sort({ visitDate: -1 })
    .limit(limit)
    .lean();
};

// Static: Get visit statistics by clinic
centralVisitSchema.statics.getVisitStats = async function(options = {}) {
  const { startDate, endDate } = options;

  const matchStage = {
    _deleted: { $ne: true },
    status: { $in: ['completed', 'checked-in', 'in-progress'] }
  };

  if (startDate || endDate) {
    matchStage.visitDate = {};
    if (startDate) matchStage.visitDate.$gte = new Date(startDate);
    if (endDate) matchStage.visitDate.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$_sourceClinic',
        totalVisits: { $sum: 1 },
        newPatients: {
          $sum: { $cond: [{ $eq: ['$visitType', 'new'] }, 1, 0] }
        },
        followUps: {
          $sum: { $cond: [{ $eq: ['$visitType', 'follow-up'] }, 1, 0] }
        },
        byDepartment: {
          $push: '$department'
        },
        uniquePatients: { $addToSet: '$patient.patientId' }
      }
    },
    {
      $project: {
        totalVisits: 1,
        newPatients: 1,
        followUps: 1,
        uniquePatientCount: { $size: '$uniquePatients' },
        departmentBreakdown: {
          $arrayToObject: {
            $map: {
              input: { $setUnion: ['$byDepartment'] },
              as: 'dept',
              in: {
                k: '$$dept',
                v: {
                  $size: {
                    $filter: {
                      input: '$byDepartment',
                      cond: { $eq: ['$$this', '$$dept'] }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  ]);
};

// Static: Get daily visit counts for chart
centralVisitSchema.statics.getDailyVisitCounts = async function(options = {}) {
  const { startDate, endDate, clinicId } = options;

  const matchStage = {
    _deleted: { $ne: true },
    status: { $in: ['completed', 'checked-in', 'in-progress'] }
  };

  if (clinicId) {
    matchStage._sourceClinic = clinicId;
  }

  if (startDate || endDate) {
    matchStage.visitDate = {};
    if (startDate) matchStage.visitDate.$gte = new Date(startDate);
    if (endDate) matchStage.visitDate.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$visitDate' } },
          clinic: '$_sourceClinic'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.date',
        clinics: {
          $push: {
            clinic: '$_id.clinic',
            count: '$count'
          }
        },
        total: { $sum: '$count' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// Static: Upsert from clinic sync
centralVisitSchema.statics.upsertFromSync = async function(clinicId, visitData) {
  const { _id, patient, provider, ...data } = visitData;

  return this.findOneAndUpdate(
    { _originalId: _id, _sourceClinic: clinicId },
    {
      $set: {
        _originalId: _id,
        _sourceClinic: clinicId,
        _syncedAt: new Date(),
        _lastModified: data.updatedAt || new Date(),
        visitNumber: data.visitNumber,
        patient: patient ? {
          _id: patient._id || patient,
          patientId: data.patientId,
          name: data.patientName
        } : null,
        visitDate: data.visitDate || data.date || data.createdAt,
        checkInTime: data.checkInTime,
        checkOutTime: data.checkOutTime,
        visitType: data.visitType || data.type || 'new',
        department: data.department || data.service,
        provider: provider ? {
          _id: provider._id || provider,
          name: data.providerName,
          role: data.providerRole
        } : null,
        chiefComplaint: data.chiefComplaint,
        diagnoses: data.diagnoses || [],
        status: data.status,
        vitals: data.vitals,
        visualAcuity: data.visualAcuity,
        hasExam: !!data.ophthalmologyExam,
        hasPrescription: !!data.prescriptions?.length,
        hasLabOrder: !!data.labOrders?.length,
        hasInvoice: !!data.invoice,
        notesSummary: data.notes?.substring(0, 500)
      },
      $inc: { _version: 1 }
    },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('CentralVisit', centralVisitSchema);
