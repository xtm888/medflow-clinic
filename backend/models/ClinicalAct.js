const mongoose = require('mongoose');

const clinicalActSchema = new mongoose.Schema({
  actId: {
    type: String,
    unique: true,
    required: true
  },

  name: {
    type: String,
    required: true
  },

  category: {
    type: String,
    enum: ['consultation', 'procedure', 'examination', 'imaging', 'laboratory', 'therapy', 'vaccination', 'screening'],
    required: true
  },

  subCategory: String,

  cptCode: String,

  icdCodes: [String],

  duration: {
    type: Number, // in minutes
    default: 30
  },

  requiredRole: [{
    type: String,
    enum: ['doctor', 'ophthalmologist', 'nurse', 'lab_technician', 'therapist', 'technician']
  }],

  requiredEquipment: [String],

  description: String,

  instructions: {
    preInstructions: String,
    postInstructions: String
  },

  contraindications: [String],

  pricing: {
    basePrice: Number,
    insuranceCode: String,
    modifiers: [String]
  },

  active: {
    type: Boolean,
    default: true
  },

  department: {
    type: String,
    enum: ['ophthalmology', 'general_medicine', 'pediatrics', 'cardiology', 'dermatology', 'ent', 'orthopedics', 'neurology', 'psychiatry']
  }
}, {
  timestamps: true
});

// Indexes
clinicalActSchema.index({ category: 1, active: 1 });
clinicalActSchema.index({ cptCode: 1 });
clinicalActSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('ClinicalAct', clinicalActSchema);