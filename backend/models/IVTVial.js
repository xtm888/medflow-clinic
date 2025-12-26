/**
 * IVT (Intravitreal Injection) Vial Tracking Model
 * Tracks multi-dose vials for anti-VEGF medications
 */

const mongoose = require('mongoose');

const VialUsageSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  injection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IVTInjection'
  },
  doseNumber: { type: Number, required: true },
  administeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  administeredAt: { type: Date, default: Date.now },
  eye: { type: String, enum: ['OD', 'OS'], required: true },
  doseVolume: { type: Number }, // ml
  verified: { type: Boolean, default: false },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String }
});

const TemperatureLogSchema = new mongoose.Schema({
  temperature: { type: Number, required: true }, // Celsius
  recordedAt: { type: Date, default: Date.now },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  location: { type: String },
  method: {
    type: String,
    enum: ['manual', 'automatic', 'sensor'],
    default: 'manual'
  },
  inRange: { type: Boolean },
  excursionType: { type: String, enum: ['none', 'high', 'low'] },
  action: { type: String }
});

const IVTVialSchema = new mongoose.Schema({
  vialNumber: {
    type: String,
    unique: true,
    required: true
  },
  medication: {
    name: { type: String, required: true },
    genericName: { type: String },
    manufacturer: { type: String },
    concentration: { type: String }, // e.g., "40mg/mL"
    totalVolume: { type: Number }, // mL per vial
    dosesPerVial: { type: Number, default: 1 }
  },
  lotNumber: { type: String, required: true },
  expirationDate: { type: Date, required: true },
  openedDate: { type: Date },
  beyondUseDate: { type: Date }, // Typically 4 hours after opening for multi-dose

  // Storage requirements
  storage: {
    requiredTempMin: { type: Number, default: 2 }, // Celsius
    requiredTempMax: { type: Number, default: 8 },
    lightSensitive: { type: Boolean, default: true },
    currentLocation: { type: String, default: 'pharmacy_refrigerator' }
  },

  // Temperature monitoring
  temperatureLogs: [TemperatureLogSchema],
  temperatureExcursions: [{
    startTime: Date,
    endTime: Date,
    minTemp: Number,
    maxTemp: Number,
    duration: Number, // minutes
    resolved: Boolean,
    resolution: String,
    disposalRequired: Boolean
  }],

  // Usage tracking
  usageHistory: [VialUsageSchema],
  dosesUsed: { type: Number, default: 0 },
  dosesRemaining: { type: Number },
  currentStatus: {
    type: String,
    enum: ['in_stock', 'in_use', 'expired', 'depleted', 'disposed', 'quarantine', 'recalled'],
    default: 'in_stock'
  },

  // Chain of custody
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receivedAt: { type: Date },
  receivedFrom: { type: String },
  purchaseOrderNumber: { type: String },
  unitCost: { type: Number },

  // Disposal
  disposal: {
    disposed: { type: Boolean, default: false },
    disposedAt: { type: Date },
    disposedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    disposalReason: {
      type: String,
      enum: ['expired', 'depleted', 'contamination', 'temperature_excursion', 'recall', 'other']
    },
    disposalMethod: { type: String },
    witnessedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String }
  },

  // Recall tracking
  recall: {
    isRecalled: { type: Boolean, default: false },
    recallDate: { type: Date },
    recallReason: { type: String },
    recallNumber: { type: String },
    affectedPatients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Patient' }]
  },

  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },

  notes: { type: String },

  // Audit trail
  history: [{
    action: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedAt: { type: Date, default: Date.now },
    details: mongoose.Schema.Types.Mixed
  }],

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

// Generate vial number
IVTVialSchema.pre('save', async function (next) {
  if (this.isNew && !this.vialNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const lastVial = await this.constructor.findOne({
      vialNumber: new RegExp(`^VIAL-${year}${month}`)
    }).sort({ vialNumber: -1 });

    let sequence = 1;
    if (lastVial) {
      const lastSequence = parseInt(lastVial.vialNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    this.vialNumber = `VIAL-${year}${month}-${String(sequence).padStart(5, '0')}`;
  }

  // Calculate doses remaining
  this.dosesRemaining = (this.medication.dosesPerVial || 1) - this.dosesUsed;

  // Update status based on conditions
  this.updateStatus();

  next();
});

// Update vial status
IVTVialSchema.methods.updateStatus = function () {
  const now = new Date();

  if (this.disposal.disposed) {
    this.currentStatus = 'disposed';
  } else if (this.recall.isRecalled) {
    this.currentStatus = 'quarantine';
  } else if (now > this.expirationDate) {
    this.currentStatus = 'expired';
  } else if (this.beyondUseDate && now > this.beyondUseDate) {
    this.currentStatus = 'expired';
  } else if (this.dosesRemaining <= 0) {
    this.currentStatus = 'depleted';
  } else if (this.openedDate) {
    this.currentStatus = 'in_use';
  } else {
    this.currentStatus = 'in_stock';
  }
};

// Open vial (start multi-dose usage)
IVTVialSchema.methods.openVial = function (userId) {
  if (this.openedDate) {
    throw new Error('Vial is already opened');
  }

  this.openedDate = new Date();

  // Calculate beyond use date (typically 4 hours for anti-VEGF)
  const beyondUse = new Date();
  beyondUse.setHours(beyondUse.getHours() + 4);
  this.beyondUseDate = beyondUse;

  this.currentStatus = 'in_use';
  this.history.push({
    action: 'vial_opened',
    performedBy: userId,
    performedAt: new Date(),
    details: { beyondUseDate: this.beyondUseDate }
  });

  return this.save();
};

// Record dose administration
IVTVialSchema.methods.recordDose = function (userId, patientId, eye, injectionId, doseVolume) {
  if (this.dosesRemaining <= 0) {
    throw new Error('No doses remaining in this vial');
  }

  if (this.currentStatus !== 'in_use' && this.currentStatus !== 'in_stock') {
    throw new Error(`Cannot use vial with status: ${this.currentStatus}`);
  }

  // Check if beyond use date passed
  if (this.beyondUseDate && new Date() > this.beyondUseDate) {
    throw new Error('Vial has exceeded beyond-use date');
  }

  this.dosesUsed++;
  this.dosesRemaining = (this.medication.dosesPerVial || 1) - this.dosesUsed;

  this.usageHistory.push({
    patient: patientId,
    injection: injectionId,
    doseNumber: this.dosesUsed,
    administeredBy: userId,
    administeredAt: new Date(),
    eye,
    doseVolume
  });

  this.history.push({
    action: 'dose_administered',
    performedBy: userId,
    performedAt: new Date(),
    details: { patient: patientId, eye, doseNumber: this.dosesUsed }
  });

  return this.save();
};

// Record temperature
IVTVialSchema.methods.recordTemperature = function (userId, temperature, location, method = 'manual') {
  const inRange = temperature >= this.storage.requiredTempMin &&
                  temperature <= this.storage.requiredTempMax;

  let excursionType = 'none';
  if (temperature < this.storage.requiredTempMin) excursionType = 'low';
  if (temperature > this.storage.requiredTempMax) excursionType = 'high';

  this.temperatureLogs.push({
    temperature,
    recordedAt: new Date(),
    recordedBy: userId,
    location,
    method,
    inRange,
    excursionType
  });

  if (!inRange) {
    this.currentStatus = 'quarantine';
    this.history.push({
      action: 'temperature_excursion',
      performedBy: userId,
      performedAt: new Date(),
      details: { temperature, excursionType }
    });
  }

  return this.save();
};

// Dispose vial
IVTVialSchema.methods.dispose = function (userId, reason, method, witnessId) {
  this.disposal = {
    disposed: true,
    disposedAt: new Date(),
    disposedBy: userId,
    disposalReason: reason,
    disposalMethod: method,
    witnessedBy: witnessId
  };
  this.currentStatus = 'disposed';

  this.history.push({
    action: 'disposed',
    performedBy: userId,
    performedAt: new Date(),
    details: { reason, method, witness: witnessId }
  });

  return this.save();
};

// Check if vial is usable
IVTVialSchema.methods.isUsable = function () {
  return ['in_stock', 'in_use'].includes(this.currentStatus) &&
         this.dosesRemaining > 0 &&
         (!this.beyondUseDate || new Date() <= this.beyondUseDate);
};

// Indexes
IVTVialSchema.index({ vialNumber: 1 });
IVTVialSchema.index({ lotNumber: 1 });
IVTVialSchema.index({ 'medication.name': 1 });
IVTVialSchema.index({ currentStatus: 1 });
IVTVialSchema.index({ expirationDate: 1 });
IVTVialSchema.index({ clinic: 1, currentStatus: 1 });
IVTVialSchema.index({ 'usageHistory.patient': 1 });

module.exports = mongoose.model('IVTVial', IVTVialSchema);
