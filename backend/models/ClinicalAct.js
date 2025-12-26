const mongoose = require('mongoose');

const clinicalActSchema = new mongoose.Schema({
  // Identification
  actId: {
    type: String,
    unique: true,
    required: true
  },

  // Names
  name: {
    type: String,
    required: true
  },
  nameFr: {
    type: String,
    required: true,
    index: true
  },

  // Classification
  category: {
    type: String,
    required: true
    // Removed enum restriction to allow flexible categories from seed data
  },
  subCategory: String,

  // Description
  description: String,
  descriptionFr: String,

  // Duration
  duration: {
    type: Number, // in minutes
    required: true,
    default: 30
  },

  // Medical Codes
  cptCode: String,
  icdCode: String,

  // Anesthesia
  anesthesiaType: {
    type: String,
    enum: ['none', 'local', 'topical', 'regional', 'general']
  },

  // Staff & Equipment Requirements
  requiredRole: [{
    type: String,
    enum: ['doctor', 'ophthalmologist', 'nurse', 'receptionist', 'pharmacist', 'lab_technician', 'anesthetist', 'technician']
  }],
  requiredEquipment: [String],

  // Department
  department: {
    type: String,
    enum: ['ophthalmology', 'general_medicine', 'laboratory', 'pharmacy', 'imaging'],
    default: 'ophthalmology'
  },

  // Instructions
  instructions: {
    preInstructions: String,
    preInstructionsFr: String,
    postInstructions: String,
    postInstructionsFr: String,
    followUpRequired: Boolean,
    followUpTiming: String
  },

  // Ophthalmic-specific details
  ophthalmicDetails: {
    isCataractSurgery: Boolean,
    iolType: String,
    isRetinalProcedure: Boolean,
    isGlaucomaProcedure: Boolean,
    isRefractiveSurgery: Boolean,
    requiresDilation: Boolean,
    requiresPressureCheck: Boolean
  },

  // Pricing
  pricing: {
    basePrice: Number,
    currency: {
      type: String,
      default: process.env.BASE_CURRENCY || 'CDF'
    },
    insuranceCode: String
  },

  // Status
  active: {
    type: Boolean,
    default: true
  },

  // Soft delete support
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date,

  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
clinicalActSchema.index({ nameFr: 1 });
clinicalActSchema.index({ category: 1, active: 1 });
clinicalActSchema.index({ department: 1, active: 1 });

const ClinicalAct = mongoose.model('ClinicalAct', clinicalActSchema);

module.exports = ClinicalAct;
