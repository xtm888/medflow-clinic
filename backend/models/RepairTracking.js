/**
 * Repair Tracking Model
 * Tracks repairs for eyeglasses, frames, equipment, and devices
 */

const mongoose = require('mongoose');

const RepairPartSchema = new mongoose.Schema({
  partName: { type: String, required: true },
  partNumber: { type: String },
  quantity: { type: Number, default: 1 },
  unitCost: { type: Number, default: 0 },
  totalCost: { type: Number },
  supplier: { type: String },
  inStock: { type: Boolean }
});

const RepairLaborSchema = new mongoose.Schema({
  description: { type: String, required: true },
  technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  technicianName: { type: String },
  hours: { type: Number },
  rate: { type: Number },
  totalCost: { type: Number },
  completedAt: { type: Date }
});

const RepairTrackingSchema = new mongoose.Schema({
  repairNumber: {
    type: String,
    unique: true,
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  customerName: { type: String },
  customerPhone: { type: String },
  customerEmail: { type: String },

  // Item being repaired
  itemType: {
    type: String,
    enum: ['eyeglasses', 'frame', 'sunglasses', 'contact_lens_case', 'equipment', 'hearing_aid', 'low_vision_device', 'other'],
    required: true
  },
  itemDescription: { type: String, required: true },
  brand: { type: String },
  model: { type: String },
  serialNumber: { type: String },
  purchasedHere: { type: Boolean, default: false },
  originalOrderId: { type: mongoose.Schema.Types.ObjectId },

  // Problem description
  problemReported: { type: String, required: true },
  problemCategory: {
    type: String,
    enum: [
      'broken_frame', 'loose_screw', 'nose_pad', 'temple_adjustment',
      'lens_scratch', 'lens_chip', 'lens_replacement', 'coating_damage',
      'hinge_repair', 'bridge_repair', 'welding', 'cleaning',
      'equipment_malfunction', 'calibration', 'other'
    ]
  },
  problemFoundOnInspection: { type: String },

  // Repair details
  repairType: {
    type: String,
    enum: ['in_house', 'send_out', 'manufacturer', 'warranty'],
    default: 'in_house'
  },
  estimatedRepairTime: { type: Number }, // hours
  actualRepairTime: { type: Number },

  // Parts and labor
  partsUsed: [RepairPartSchema],
  laborPerformed: [RepairLaborSchema],

  // Costs
  estimatedCost: { type: Number },
  partsCost: { type: Number, default: 0 },
  laborCost: { type: Number, default: 0 },
  additionalCosts: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  discountApplied: { type: Number, default: 0 },
  finalCost: { type: Number, default: 0 },

  // Warranty information
  coveredUnderWarranty: { type: Boolean, default: false },
  warrantyId: { type: mongoose.Schema.Types.ObjectId, ref: 'WarrantyTracking' },
  warrantyClaimNumber: { type: String },

  // Status tracking
  status: {
    type: String,
    enum: [
      'received', 'inspecting', 'waiting_approval', 'approved',
      'waiting_parts', 'in_repair', 'quality_check', 'ready_pickup',
      'completed', 'cancelled', 'unrepairable'
    ],
    default: 'received'
  },
  statusHistory: [{
    status: String,
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String
  }],

  // Dates
  receivedDate: { type: Date, default: Date.now },
  inspectionDate: { type: Date },
  approvalDate: { type: Date },
  repairStartDate: { type: Date },
  repairCompletedDate: { type: Date },
  pickedUpDate: { type: Date },
  estimatedCompletionDate: { type: Date },

  // Assignment
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  inspectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Customer approval
  customerApproval: {
    required: { type: Boolean, default: true },
    approved: { type: Boolean },
    approvalMethod: { type: String, enum: ['in_person', 'phone', 'email', 'sms'] },
    approvedAt: { type: Date },
    declinedReason: { type: String }
  },

  // Send out repairs
  sendOut: {
    sentTo: { type: String },
    sentDate: { type: Date },
    trackingNumber: { type: String },
    expectedReturnDate: { type: Date },
    returnedDate: { type: Date },
    vendorInvoice: { type: String },
    vendorCost: { type: Number }
  },

  // Quality check
  qualityCheck: {
    performed: { type: Boolean, default: false },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedAt: { type: Date },
    passed: { type: Boolean },
    notes: { type: String }
  },

  // Communication
  notifications: [{
    type: { type: String, enum: ['sms', 'email', 'call'] },
    sentAt: Date,
    message: String,
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  // Additional fields
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  location: { type: String }, // Where item is stored during repair
  notes: { type: String },
  internalNotes: { type: String },

  // Photos
  beforePhotos: [{
    url: String,
    caption: String,
    uploadedAt: Date
  }],
  afterPhotos: [{
    url: String,
    caption: String,
    uploadedAt: Date
  }],

  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },

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

// Generate repair number
RepairTrackingSchema.pre('save', async function (next) {
  if (this.isNew && !this.repairNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const lastRepair = await this.constructor.findOne({
      repairNumber: new RegExp(`^RPR-${year}${month}`)
    }).sort({ repairNumber: -1 });

    let sequence = 1;
    if (lastRepair) {
      const lastSequence = parseInt(lastRepair.repairNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    this.repairNumber = `RPR-${year}${month}-${String(sequence).padStart(5, '0')}`;
  }

  // Calculate costs
  this.partsCost = this.partsUsed.reduce((sum, p) => sum + (p.totalCost || p.unitCost * p.quantity), 0);
  this.laborCost = this.laborPerformed.reduce((sum, l) => sum + (l.totalCost || 0), 0);
  this.totalCost = this.partsCost + this.laborCost + (this.additionalCosts || 0);
  this.finalCost = this.totalCost - (this.discountApplied || 0);

  if (this.coveredUnderWarranty) {
    this.finalCost = 0;
  }

  next();
});

// Update status
RepairTrackingSchema.methods.updateStatus = function (userId, newStatus, notes) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    changedAt: new Date(),
    changedBy: userId,
    notes
  });

  // Update relevant dates
  const now = new Date();
  switch (newStatus) {
    case 'inspecting':
      this.inspectionDate = now;
      break;
    case 'approved':
      this.approvalDate = now;
      break;
    case 'in_repair':
      this.repairStartDate = now;
      break;
    case 'quality_check':
    case 'ready_pickup':
      this.repairCompletedDate = now;
      break;
    case 'completed':
      this.pickedUpDate = now;
      break;
  }

  this.history.push({
    action: 'status_changed',
    performedBy: userId,
    performedAt: now,
    details: { newStatus, notes }
  });

  return this.save();
};

// Add part
RepairTrackingSchema.methods.addPart = function (userId, partData) {
  partData.totalCost = partData.unitCost * partData.quantity;
  this.partsUsed.push(partData);

  this.history.push({
    action: 'part_added',
    performedBy: userId,
    performedAt: new Date(),
    details: partData
  });

  return this.save();
};

// Add labor
RepairTrackingSchema.methods.addLabor = function (userId, laborData) {
  laborData.totalCost = laborData.hours * laborData.rate;
  this.laborPerformed.push(laborData);

  this.history.push({
    action: 'labor_added',
    performedBy: userId,
    performedAt: new Date(),
    details: laborData
  });

  return this.save();
};

// Customer approval
RepairTrackingSchema.methods.recordCustomerApproval = function (userId, approved, method, declinedReason = null) {
  this.customerApproval = {
    required: true,
    approved,
    approvalMethod: method,
    approvedAt: new Date(),
    declinedReason
  };

  if (approved) {
    this.status = 'approved';
  } else {
    this.status = 'cancelled';
  }

  this.history.push({
    action: approved ? 'customer_approved' : 'customer_declined',
    performedBy: userId,
    performedAt: new Date(),
    details: { method, reason: declinedReason }
  });

  return this.save();
};

// Quality check
RepairTrackingSchema.methods.performQualityCheck = function (userId, passed, notes) {
  this.qualityCheck = {
    performed: true,
    performedBy: userId,
    performedAt: new Date(),
    passed,
    notes
  };

  if (passed) {
    this.status = 'ready_pickup';
  } else {
    this.status = 'in_repair'; // Send back for rework
  }

  this.history.push({
    action: 'quality_check',
    performedBy: userId,
    performedAt: new Date(),
    details: { passed, notes }
  });

  return this.save();
};

// Indexes
RepairTrackingSchema.index({ repairNumber: 1 });
RepairTrackingSchema.index({ customer: 1 });
RepairTrackingSchema.index({ status: 1 });
RepairTrackingSchema.index({ clinic: 1, status: 1 });
RepairTrackingSchema.index({ assignedTo: 1, status: 1 });
RepairTrackingSchema.index({ receivedDate: -1 });
RepairTrackingSchema.index({ estimatedCompletionDate: 1 });

module.exports = mongoose.model('RepairTracking', RepairTrackingSchema);
