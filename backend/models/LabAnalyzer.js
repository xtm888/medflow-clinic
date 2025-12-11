const mongoose = require('mongoose');

/**
 * LabAnalyzer Model
 * Tracks laboratory instruments/analyzers and their configurations
 * Each analyzer can have different reference ranges for the same test
 */

const labAnalyzerSchema = new mongoose.Schema({
  // Clinic reference (multi-clinic support)
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true,
    index: true
  },

  // Analyzer identification
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true
  },
  serialNumber: {
    type: String,
    trim: true
  },

  // Manufacturer details
  manufacturer: {
    type: String,
    required: true,
    enum: [
      'Roche',
      'Siemens',
      'Abbott',
      'Beckman Coulter',
      'Sysmex',
      'Bio-Rad',
      'Ortho Clinical',
      'Werfen',
      'Horiba',
      'Mindray',
      'Stago',
      'Radiometer',
      'Instrumentation Laboratory',
      'Autre'
    ],
    index: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  modelFamily: {
    type: String,
    trim: true // e.g., "Cobas 8000", "Atellica", "Alinity"
  },

  // Analyzer type/department
  analyzerType: {
    type: String,
    required: true,
    enum: [
      'chemistry',           // Biochimie
      'hematology',          // Hématologie
      'coagulation',         // Coagulation
      'immunoassay',         // Immunologie
      'urinalysis',          // Analyse d'urine
      'blood-gas',           // Gaz du sang
      'microbiology',        // Microbiologie
      'molecular',           // Biologie moléculaire
      'point-of-care',       // POC
      'multi-discipline'     // Multi-disciplinaire
    ],
    index: true
  },

  // Location in lab
  location: {
    department: String,
    room: String,
    bench: String
  },

  // Operational status
  status: {
    type: String,
    enum: ['active', 'maintenance', 'calibrating', 'offline', 'retired'],
    default: 'active',
    index: true
  },

  // Installation and maintenance dates
  installationDate: Date,
  lastMaintenanceDate: Date,
  nextMaintenanceDate: Date,
  lastCalibrationDate: Date,
  nextCalibrationDate: Date,

  // Supported tests (linked to LaboratoryTemplate)
  supportedTests: [{
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LaboratoryTemplate'
    },
    testCode: String,
    testName: String,
    // Analyzer-specific method info
    methodName: String,
    methodCode: String
  }],

  // Current active reagent lots for this analyzer
  activeReagentLots: [{
    testCode: String,
    reagentLot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReagentLot'
    },
    activatedAt: Date,
    activatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // QC configuration
  qcConfig: {
    // How often QC must be run
    qcFrequency: {
      type: String,
      enum: ['each-run', 'daily', 'per-shift', 'weekly'],
      default: 'daily'
    },
    // QC levels used
    qcLevels: [{
      level: String,        // "Level 1", "Level 2", "Level 3"
      material: String,     // QC material name
      lotNumber: String
    }],
    // Westgard rules enabled
    westgardRules: [{
      type: String,
      enum: ['1-2s', '1-3s', '2-2s', 'R-4s', '4-1s', '10x']
    }]
  },

  // Interface/connectivity
  interfaceConfig: {
    connectionType: {
      type: String,
      enum: ['LIS', 'ASTM', 'HL7', 'serial', 'tcp-ip', 'manual'],
      default: 'manual'
    },
    hostIP: String,
    port: Number,
    bidirectional: {
      type: Boolean,
      default: false
    }
  },

  // Notes and documentation
  notes: String,
  documentationUrl: String,

  // Audit
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
labAnalyzerSchema.index({ clinic: 1, code: 1 }, { unique: true });
labAnalyzerSchema.index({ clinic: 1, manufacturer: 1, status: 1 });
labAnalyzerSchema.index({ clinic: 1, analyzerType: 1, isActive: 1 });

// Virtual for display name
labAnalyzerSchema.virtual('displayName').get(function() {
  return `${this.manufacturer} ${this.model} (${this.code})`;
});

// Method to check if analyzer supports a test
labAnalyzerSchema.methods.supportsTest = function(testCode) {
  return this.supportedTests.some(t => t.testCode === testCode);
};

// Method to get active reagent lot for a test
labAnalyzerSchema.methods.getActiveReagentLot = function(testCode) {
  const active = this.activeReagentLots.find(r => r.testCode === testCode);
  return active?.reagentLot;
};

// Method to set active reagent lot
labAnalyzerSchema.methods.setActiveReagentLot = async function(testCode, reagentLotId, userId) {
  // Remove existing active lot for this test
  this.activeReagentLots = this.activeReagentLots.filter(r => r.testCode !== testCode);

  // Add new active lot
  this.activeReagentLots.push({
    testCode,
    reagentLot: reagentLotId,
    activatedAt: new Date(),
    activatedBy: userId
  });

  return this.save();
};

// Static to find analyzers for a specific test
labAnalyzerSchema.statics.findForTest = function(clinicId, testCode) {
  return this.find({
    clinic: clinicId,
    isActive: true,
    status: 'active',
    'supportedTests.testCode': testCode
  });
};

// Static to find by manufacturer
labAnalyzerSchema.statics.findByManufacturer = function(clinicId, manufacturer) {
  return this.find({
    clinic: clinicId,
    manufacturer,
    isActive: true
  });
};

// Ensure virtuals are included
labAnalyzerSchema.set('toJSON', { virtuals: true });
labAnalyzerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LabAnalyzer', labAnalyzerSchema);
