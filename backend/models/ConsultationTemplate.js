const mongoose = require('mongoose');

/**
 * ConsultationTemplate - Pre-defined templates for common consultation types
 *
 * Templates contain prefill data for:
 * - Chief complaint / motif
 * - Default examinations to perform
 * - Common diagnoses for this type
 * - Typical medications/prescriptions
 * - Follow-up recommendations
 */
const consultationTemplateSchema = new mongoose.Schema({
  // Basic info
  name: {
    type: String,
    required: true,
    trim: true
  },

  description: {
    type: String,
    trim: true
  },

  // Template type/category
  type: {
    type: String,
    required: true,
    enum: [
      'routine',           // Routine refraction visit
      'glaucoma-followup', // Glaucoma follow-up
      'post-cataract',     // Post-cataract surgery
      'diabetic-screening', // Diabetic retinopathy screening
      'red-eye',           // Red/painful eye
      'presbyopia',        // Presbyopia control
      'pediatric',         // Pediatric exam
      'contact-lens',      // Contact lens fitting
      'custom'             // Custom user-created
    ]
  },

  category: {
    type: String,
    enum: ['refraction', 'surgical', 'medical', 'screening', 'pediatric', 'other'],
    default: 'other'
  },

  // Is this a system-provided template (vs user-created)
  isSystemTemplate: {
    type: Boolean,
    default: false
  },

  // Who created this template (null for system templates)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Clinic this template belongs to (null = available to all)
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    default: null
  },

  // Template is active/visible
  isActive: {
    type: Boolean,
    default: true
  },

  // Template is pinned/favorited
  isPinned: {
    type: Boolean,
    default: false
  },

  // Display order (lower = show first)
  order: {
    type: Number,
    default: 100
  },

  // Icon for display
  icon: {
    type: String,
    default: 'file-text'
  },

  // Color theme
  color: {
    type: String,
    default: 'blue'
  },

  // Prefill data for the consultation
  prefillData: {
    // Chief complaint section
    complaint: {
      motif: { type: String, default: '' },
      duration: { type: String, default: '' },
      durationUnit: { type: String, enum: ['hours', 'days', 'weeks', 'months', 'years'], default: 'days' },
      severity: { type: String, enum: ['', 'mild', 'moderate', 'severe'], default: '' },
      notes: { type: String, default: '' }
    },

    // Examinations to pre-check/expand
    examination: {
      // Which exam sections to expand/focus on
      focusSections: [{
        type: String,
        enum: ['visualAcuity', 'refraction', 'iop', 'slitLamp', 'fundus', 'gonioscopy', 'visualField', 'oct']
      }],

      // Specific fields to highlight
      requiredFields: [String],

      // Default notes
      notes: { type: String, default: '' }
    },

    // Common diagnoses for this template
    diagnoses: [{
      code: { type: String, required: true },
      name: { type: String, required: true },
      category: { type: String }
    }],

    // Common procedures to order
    procedures: [{
      code: { type: String, required: true },
      name: { type: String, required: true },
      category: { type: String },
      laterality: { type: String, enum: ['OD', 'OS', 'OU'], default: 'OU' }
    }],

    // Typical medications
    medications: [{
      name: { type: String, required: true },
      dosage: { type: String },
      frequency: { type: String },
      duration: { type: String },
      instructions: { type: String }
    }],

    // Follow-up recommendation
    followUp: {
      suggestedInterval: { type: Number }, // in days
      intervalUnit: { type: String, enum: ['days', 'weeks', 'months'], default: 'months' },
      notes: { type: String, default: '' }
    }
  },

  // Usage statistics
  usageCount: {
    type: Number,
    default: 0
  },

  lastUsedAt: {
    type: Date
  }

}, {
  timestamps: true
});

// Indexes
consultationTemplateSchema.index({ type: 1, isActive: 1 });
consultationTemplateSchema.index({ clinic: 1, isActive: 1 });
consultationTemplateSchema.index({ isSystemTemplate: 1 });
consultationTemplateSchema.index({ order: 1 });

// Virtual for formatted usage
consultationTemplateSchema.virtual('usageStats').get(function() {
  return {
    count: this.usageCount,
    lastUsed: this.lastUsedAt ? this.lastUsedAt.toISOString() : null
  };
});

// Method to increment usage
consultationTemplateSchema.methods.recordUsage = async function() {
  this.usageCount += 1;
  this.lastUsedAt = new Date();
  await this.save();
};

// Static method to get templates for a clinic
consultationTemplateSchema.statics.getTemplatesForClinic = function(clinicId) {
  return this.find({
    isActive: true,
    $or: [
      { clinic: null, isSystemTemplate: true },
      { clinic: clinicId }
    ]
  }).sort({ order: 1, name: 1 });
};

// Static method to get system templates
consultationTemplateSchema.statics.getSystemTemplates = function() {
  return this.find({
    isSystemTemplate: true,
    isActive: true
  }).sort({ order: 1 });
};

module.exports = mongoose.model('ConsultationTemplate', consultationTemplateSchema);
