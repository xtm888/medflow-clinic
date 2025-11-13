const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  templateId: {
    type: String,
    unique: true,
    sparse: true
  },

  name: {
    type: String,
    required: true
  },

  category: {
    type: String,
    enum: ['medication', 'pathology', 'prescription', 'letter', 'instruction', 'diagnosis', 'plan', 'examination'],
    required: true
  },

  subCategory: String,

  tags: [String],

  isActive: {
    type: Boolean,
    default: true
  },

  isDefault: {
    type: Boolean,
    default: false
  },

  isGlobal: {
    type: Boolean,
    default: false // If true, available to all users
  },

  // Template content based on category
  content: {
    // For medications
    medications: [{
      name: String,
      genericName: String,
      dosage: String,
      strength: String,
      frequency: String,
      duration: String,
      route: String,
      instructions: String,
      quantity: String,
      refills: Number,
      indication: String
    }],

    // For pathology
    pathology: {
      diagnosis: String,
      icdCode: String,
      symptoms: [String],
      findings: [String],
      severity: String,
      plan: String,
      followUp: String,
      complications: [String]
    },

    // For letters/correspondence
    letter: {
      subject: String,
      salutation: String,
      body: String, // Supports variables like {{patientName}}, {{date}}, {{diagnosis}}
      closing: String,
      footer: String,
      cc: [String],
      attachments: [String]
    },

    // For prescriptions (optical)
    prescription: {
      glasses: {
        OD: {
          sphere: String,
          cylinder: String,
          axis: String,
          add: String,
          prism: String,
          base: String
        },
        OS: {
          sphere: String,
          cylinder: String,
          axis: String,
          add: String,
          prism: String,
          base: String
        },
        pd: {
          distance: String,
          near: String
        },
        lensType: String,
        coating: [String],
        tint: String,
        instructions: String
      },
      contacts: {
        OD: {
          brand: String,
          power: String,
          baseCurve: String,
          diameter: String,
          cylinder: String,
          axis: String
        },
        OS: {
          brand: String,
          power: String,
          baseCurve: String,
          diameter: String,
          cylinder: String,
          axis: String
        },
        wearSchedule: String,
        replacementSchedule: String,
        instructions: String
      }
    },

    // For patient instructions
    instruction: {
      title: String,
      steps: [String],
      warnings: [String],
      whenToCall: [String],
      followUp: String
    },

    // For diagnoses
    diagnosis: {
      code: String,
      description: String,
      laterality: String,
      severity: String,
      associatedConditions: [String],
      workup: [String],
      treatment: [String]
    },

    // For treatment plans
    plan: {
      immediate: [String],
      shortTerm: [String],
      longTerm: [String],
      lifestyle: [String],
      followUp: String,
      referrals: [String],
      monitoring: [String]
    },

    // For examinations
    examination: {
      name: String,
      normalFindings: String,
      abnormalFindings: [String],
      technique: String,
      interpretation: String,
      documentation: String
    },

    // Raw text for simple templates
    rawText: String,

    // Variables used in the template
    variables: [{
      name: String,
      type: String, // text, number, date, select
      options: [String], // For select type
      defaultValue: String,
      required: Boolean
    }]
  },

  // Usage tracking
  usageCount: {
    type: Number,
    default: 0
  },

  lastUsed: Date,

  // Permissions
  permissions: {
    roles: [{
      type: String,
      enum: ['admin', 'doctor', 'ophthalmologist', 'nurse', 'receptionist', 'pharmacist', 'lab_technician', 'accountant']
    }],
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    departments: [String]
  },

  // Quick access settings
  quickAccess: {
    isPinned: Boolean,
    shortcut: String,
    order: Number
  },

  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  sharedWith: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    canEdit: Boolean,
    sharedAt: Date
  }],

  // Version control
  version: {
    type: Number,
    default: 1
  },

  previousVersions: [{
    version: Number,
    content: mongoose.Schema.Types.Mixed,
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    modifiedAt: Date
  }],

  // Clinical validation
  clinicalValidation: {
    isValidated: Boolean,
    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    validatedAt: Date,
    validationNotes: String,
    expiryDate: Date
  },

  // Source and references
  source: {
    type: String,
    reference: String,
    evidenceLevel: String
  }
}, {
  timestamps: true
});

// Indexes
templateSchema.index({ category: 1, isActive: 1 });
templateSchema.index({ name: 'text', tags: 'text' });
templateSchema.index({ createdBy: 1 });
templateSchema.index({ 'permissions.roles': 1 });
templateSchema.index({ isGlobal: 1, isActive: 1 });

// Generate unique templateId
templateSchema.pre('save', async function(next) {
  if (!this.templateId) {
    const prefix = this.category.substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.templateId = `TPL-${prefix}-${random}`;
  }

  // Update version if content changed
  if (this.isModified('content') && !this.isNew) {
    // Save current version to history
    this.previousVersions = this.previousVersions || [];
    this.previousVersions.push({
      version: this.version,
      content: this.content,
      modifiedBy: this.modifiedBy,
      modifiedAt: new Date()
    });
    this.version += 1;
  }

  next();
});

// Method to apply template with variable substitution
templateSchema.methods.applyTemplate = function(context) {
  let result = JSON.parse(JSON.stringify(this.content));

  // Function to replace variables in a string
  const replaceVariables = (str) => {
    if (typeof str !== 'string') return str;

    return str.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return context[variable] || match;
    });
  };

  // Recursively replace variables in the result object
  const processObject = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = replaceVariables(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        processObject(obj[key]);
      }
    }
  };

  processObject(result);

  // Increment usage count
  this.usageCount += 1;
  this.lastUsed = new Date();
  this.save();

  return result;
};

// Method to clone template
templateSchema.methods.cloneTemplate = function(userId, modifications = {}) {
  const cloned = this.toObject();
  delete cloned._id;
  delete cloned.templateId;
  delete cloned.createdAt;
  delete cloned.updatedAt;

  cloned.name = modifications.name || `${cloned.name} (Copy)`;
  cloned.createdBy = userId;
  cloned.isGlobal = false;
  cloned.usageCount = 0;
  cloned.lastUsed = null;
  cloned.version = 1;
  cloned.previousVersions = [];

  // Apply any modifications
  Object.assign(cloned, modifications);

  return new this.constructor(cloned);
};

// Static method to get templates by category and user permissions
templateSchema.statics.getTemplatesByCategory = async function(category, userId, userRole) {
  const query = {
    category,
    isActive: true,
    $or: [
      { isGlobal: true },
      { createdBy: userId },
      { 'sharedWith.user': userId },
      { 'permissions.roles': userRole }
    ]
  };

  return this.find(query)
    .sort({ usageCount: -1, name: 1 })
    .select('-previousVersions');
};

// Static method to get favorite templates
templateSchema.statics.getFavorites = async function(userId, limit = 10) {
  return this.find({
    isActive: true,
    $or: [
      { createdBy: userId },
      { 'sharedWith.user': userId }
    ]
  })
  .sort({ usageCount: -1, lastUsed: -1 })
  .limit(limit)
  .select('-previousVersions -content');
};

module.exports = mongoose.model('Template', templateSchema);