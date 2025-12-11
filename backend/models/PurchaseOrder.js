/**
 * Purchase Order Model
 * Manages procurement workflow for pharmacy and inventory items
 */

const mongoose = require('mongoose');

const PurchaseOrderItemSchema = new mongoose.Schema({
  inventoryType: {
    type: String,
    enum: ['pharmacy', 'frame', 'contactLens', 'opticalLens', 'reagent', 'labConsumable', 'surgicalSupply'],
    required: true
  },
  inventoryItemId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'items.inventoryType'
  },
  itemName: { type: String, required: true },
  itemCode: { type: String },
  description: { type: String },
  quantityOrdered: { type: Number, required: true, min: 1 },
  quantityReceived: { type: Number, default: 0 },
  unit: { type: String, required: true },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number },
  discount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  netPrice: { type: Number },
  receivedDate: { type: Date },
  expirationDate: { type: Date },
  lotNumber: { type: String },
  status: {
    type: String,
    enum: ['pending', 'partial', 'received', 'cancelled'],
    default: 'pending'
  },
  notes: { type: String }
});

// Calculate totals before save
PurchaseOrderItemSchema.pre('save', function (next) {
  this.totalPrice = this.quantityOrdered * this.unitPrice;
  this.netPrice = this.totalPrice - this.discount + this.tax;
  next();
});

const PurchaseOrderSchema = new mongoose.Schema({
  poNumber: {
    type: String,
    unique: true,
    required: true
  },
  supplier: {
    name: { type: String, required: true },
    contactPerson: { type: String },
    email: { type: String },
    phone: { type: String },
    address: { type: String },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' }
  },
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  department: {
    type: String,
    enum: ['pharmacy', 'optical', 'laboratory', 'surgery', 'general'],
    required: true
  },
  items: [PurchaseOrderItemSchema],
  orderType: {
    type: String,
    enum: ['manual', 'auto_reorder', 'emergency', 'scheduled'],
    default: 'manual'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'sent', 'partial_received', 'received', 'cancelled', 'closed'],
    default: 'draft'
  },
  subtotal: { type: Number, default: 0 },
  totalDiscount: { type: Number, default: 0 },
  totalTax: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  paymentTerms: { type: String },
  deliveryTerms: { type: String },
  expectedDeliveryDate: { type: Date },
  actualDeliveryDate: { type: Date },
  shippingAddress: { type: String },
  notes: { type: String },
  internalNotes: { type: String },

  // Workflow tracking
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvalRequired: { type: Boolean, default: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedAt: { type: Date },
  rejectionReason: { type: String },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sentAt: { type: Date },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  closedAt: { type: Date },

  // Auto-reorder reference
  autoReorderTriggerId: { type: mongoose.Schema.Types.ObjectId },
  reorderTriggerItems: [{ type: mongoose.Schema.Types.ObjectId }],

  // Document attachments
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: Date,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  // Audit trail
  history: [{
    action: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedAt: { type: Date, default: Date.now },
    details: mongoose.Schema.Types.Mixed
  }]
}, {
  timestamps: true
});

// Generate PO number
PurchaseOrderSchema.pre('save', async function (next) {
  if (this.isNew && !this.poNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Find the last PO number for this month
    const lastPO = await this.constructor.findOne({
      poNumber: new RegExp(`^PO-${year}${month}`)
    }).sort({ poNumber: -1 });

    let sequence = 1;
    if (lastPO) {
      const lastSequence = parseInt(lastPO.poNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    this.poNumber = `PO-${year}${month}-${String(sequence).padStart(5, '0')}`;
  }

  // Calculate totals
  this.subtotal = this.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  this.totalDiscount = this.items.reduce((sum, item) => sum + (item.discount || 0), 0);
  this.totalTax = this.items.reduce((sum, item) => sum + (item.tax || 0), 0);
  this.grandTotal = this.subtotal - this.totalDiscount + this.totalTax + (this.shippingCost || 0);

  next();
});

// Add history entry
PurchaseOrderSchema.methods.addHistory = function (action, userId, details) {
  this.history.push({
    action,
    performedBy: userId,
    performedAt: new Date(),
    details
  });
};

// Submit for approval
PurchaseOrderSchema.methods.submitForApproval = function (userId) {
  if (this.status !== 'draft') {
    throw new Error('Only draft POs can be submitted for approval');
  }
  this.status = 'pending_approval';
  this.addHistory('submitted_for_approval', userId, { previousStatus: 'draft' });
  return this.save();
};

// Approve PO
PurchaseOrderSchema.methods.approve = function (userId) {
  if (this.status !== 'pending_approval') {
    throw new Error('Only pending POs can be approved');
  }
  this.status = 'approved';
  this.approvedBy = userId;
  this.approvedAt = new Date();
  this.addHistory('approved', userId);
  return this.save();
};

// Reject PO
PurchaseOrderSchema.methods.reject = function (userId, reason) {
  if (this.status !== 'pending_approval') {
    throw new Error('Only pending POs can be rejected');
  }
  this.status = 'draft';
  this.rejectedBy = userId;
  this.rejectedAt = new Date();
  this.rejectionReason = reason;
  this.addHistory('rejected', userId, { reason });
  return this.save();
};

// Mark as sent to supplier
PurchaseOrderSchema.methods.markSent = function (userId) {
  if (this.status !== 'approved') {
    throw new Error('Only approved POs can be sent');
  }
  this.status = 'sent';
  this.sentBy = userId;
  this.sentAt = new Date();
  this.addHistory('sent_to_supplier', userId);
  return this.save();
};

// Receive items
PurchaseOrderSchema.methods.receiveItems = function (userId, itemsReceived) {
  let allReceived = true;

  for (const received of itemsReceived) {
    const item = this.items.id(received.itemId);
    if (item) {
      item.quantityReceived += received.quantity;
      item.receivedDate = new Date();
      if (received.lotNumber) item.lotNumber = received.lotNumber;
      if (received.expirationDate) item.expirationDate = received.expirationDate;

      if (item.quantityReceived >= item.quantityOrdered) {
        item.status = 'received';
      } else if (item.quantityReceived > 0) {
        item.status = 'partial';
        allReceived = false;
      } else {
        allReceived = false;
      }
    }
  }

  this.status = allReceived ? 'received' : 'partial_received';
  this.receivedBy = userId;
  if (allReceived) {
    this.actualDeliveryDate = new Date();
  }

  this.addHistory('items_received', userId, { items: itemsReceived });
  return this.save();
};

// Close PO
PurchaseOrderSchema.methods.close = function (userId) {
  this.status = 'closed';
  this.closedBy = userId;
  this.closedAt = new Date();
  this.addHistory('closed', userId);
  return this.save();
};

// Indexes
PurchaseOrderSchema.index({ poNumber: 1 });
PurchaseOrderSchema.index({ status: 1 });
PurchaseOrderSchema.index({ clinic: 1, status: 1 });
PurchaseOrderSchema.index({ 'supplier.name': 1 });
PurchaseOrderSchema.index({ createdAt: -1 });
PurchaseOrderSchema.index({ expectedDeliveryDate: 1 });

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);
