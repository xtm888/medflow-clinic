const mongoose = require('mongoose');

const documentTemplateSchema = new mongoose.Schema({
  // Identification
  templateId: {
    type: String,
    unique: true,
    required: true
  },

  // Template Information
  name: {
    type: String,
    required: true
  },
  nameEn: {
    type: String // English translation
  },

  // Template Content
  content: {
    type: String,
    required: true
  },

  // Category
  category: {
    type: String,
    enum: [
      'certificate', // Medical certificates
      'surgical_consent', // Surgical consent forms
      'operative_report', // Operative reports
      'correspondence', // Letters to colleagues
      'prescription_instructions', // Pre/post-op instructions
      'payment', // Payment receipts and requests
      'reminder', // Patient reminders
      'examination_report' // Examination reports
    ],
    required: true
  },

  // Sub-category for more specificity
  subCategory: {
    type: String,
    enum: [
      'visual_acuity',
      'consultation',
      'medical_leave',
      'fitness',
      'school',
      'glasses_required',
      'myopia_surgery',
      'cataract_surgery',
      'general_surgery',
      'ultrasound',
      'visual_field',
      'refraction',
      'iop',
      'follow_up',
      'payment_receipt',
      'payment_request',
      'missed_appointment',
      'general'
    ]
  },

  // Department/Specialty
  specialty: {
    type: String,
    enum: ['general', 'ophthalmology', 'orthoptic', 'surgery'],
    default: 'ophthalmology'
  },

  // Language
  language: {
    type: String,
    enum: ['fr', 'en'],
    default: 'fr'
  },

  // Variable placeholders in the template
  variables: [{
    name: String, // e.g., 'patientName', 'dateOfBirth'
    label: String, // Display label
    type: {
      type: String,
      enum: ['text', 'date', 'number', 'select', 'boolean'],
      default: 'text'
    },
    required: {
      type: Boolean,
      default: false
    },
    defaultValue: String,
    options: [String] // For select type
  }],

  // Usage metadata
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: Date,

  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft'],
    default: 'active'
  },

  // Version control
  version: {
    type: Number,
    default: 1
  },
  previousVersions: [{
    version: Number,
    content: String,
    updatedAt: Date,
    updatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
  }],

  // Metadata
  description: String,
  tags: [String],

  // Permissions - which roles can use this template
  allowedRoles: [{
    type: String,
    enum: ['admin', 'doctor', 'ophthalmologist', 'nurse', 'receptionist', 'orthoptist']
  }],

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

// Indexes
documentTemplateSchema.index({ category: 1, subCategory: 1 });
documentTemplateSchema.index({ specialty: 1, status: 1 });
documentTemplateSchema.index({ templateId: 1 });
documentTemplateSchema.index({ tags: 1 });

// Generate template ID
documentTemplateSchema.pre('save', async function(next) {
  if (!this.templateId) {
    const count = await this.constructor.countDocuments();
    this.templateId = `TPL${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Method to increment usage count
documentTemplateSchema.methods.recordUsage = async function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  await this.save();
};

// Static method to get popular templates
documentTemplateSchema.statics.getPopularTemplates = async function(limit = 10) {
  return this.find({ status: 'active' })
    .sort({ usageCount: -1 })
    .limit(limit);
};

// Static method to get templates by category
documentTemplateSchema.statics.getByCategory = async function(category, specialty = null) {
  const query = { category, status: 'active' };
  if (specialty) query.specialty = specialty;
  return this.find(query).sort({ name: 1 });
};

module.exports = mongoose.model('DocumentTemplate', documentTemplateSchema);
