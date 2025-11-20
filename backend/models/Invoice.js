const mongoose = require('mongoose');
const crypto = require('crypto');

const invoiceSchema = new mongoose.Schema({
  invoiceId: {
    type: String,
    unique: true,
    required: true
  },

  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },

  visit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Visit',
    index: true
  },

  dateIssued: {
    type: Date,
    default: Date.now,
    required: true
  },

  dueDate: {
    type: Date,
    required: true
  },

  // Invoice line items
  items: [{
    description: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ['consultation', 'procedure', 'medication', 'imaging', 'laboratory', 'therapy', 'device', 'other'],
      required: true
    },
    code: String, // CPT/billing code
    quantity: {
      type: Number,
      default: 1,
      min: 0
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    subtotal: {
      type: Number,
      required: true
    },
    tax: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true
    },
    reference: {
      type: String // Reference to prescription, exam, etc.
    }
  }],

  // Financial summary
  summary: {
    subtotal: {
      type: Number,
      required: true,
      default: 0
    },
    discountTotal: {
      type: Number,
      default: 0
    },
    taxTotal: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true,
      default: 0
    },
    amountPaid: {
      type: Number,
      default: 0
    },
    amountDue: {
      type: Number,
      required: true
    }
  },

  // Payment information
  payments: [{
    paymentId: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    method: {
      type: String,
      enum: ['cash', 'card', 'check', 'bank-transfer', 'insurance', 'mobile-payment', 'other'],
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    reference: String, // Transaction reference number
    notes: String,
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],

  // Invoice status
  status: {
    type: String,
    enum: ['draft', 'issued', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled', 'refunded'],
    default: 'draft',
    index: true
  },

  // Insurance information
  insurance: {
    used: {
      type: Boolean,
      default: false
    },
    provider: String,
    policyNumber: String,
    claimNumber: String,
    claimStatus: {
      type: String,
      enum: ['pending', 'submitted', 'approved', 'partially-approved', 'rejected', 'paid']
    },
    claimAmount: Number,
    approvedAmount: Number,
    patientResponsibility: Number,
    submittedDate: Date,
    approvedDate: Date
  },

  // Billing details
  billing: {
    billTo: {
      name: String,
      address: {
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: String
      },
      phone: String,
      email: String
    },
    currency: {
      type: String,
      default: 'CFA' // West African CFA franc
    },
    taxRate: {
      type: Number,
      default: 0
    }
  },

  // Notes and communication
  notes: {
    internal: String, // Staff notes
    patient: String,  // Notes visible to patient
    billing: String   // Billing department notes
  },

  // Tracking
  sentDate: Date,
  viewedDate: Date,
  paidDate: Date,

  // Reminders
  reminders: [{
    sentDate: Date,
    method: {
      type: String,
      enum: ['email', 'sms', 'phone', 'mail']
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Cancellation/Refund
  cancellation: {
    cancelled: {
      type: Boolean,
      default: false
    },
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String
  },

  refund: {
    refunded: {
      type: Boolean,
      default: false
    },
    refundedAt: Date,
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    amount: Number,
    reason: String,
    method: String
  },

  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Version control for optimistic locking
  version: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
invoiceSchema.index({ invoiceId: 1 });
invoiceSchema.index({ patient: 1, dateIssued: -1 });
invoiceSchema.index({ status: 1, dueDate: 1 });
invoiceSchema.index({ 'insurance.claimStatus': 1 });
invoiceSchema.index({ createdAt: -1 });

// Virtual for days overdue
invoiceSchema.virtual('daysOverdue').get(function() {
  if (this.status !== 'overdue') return 0;
  const today = new Date();
  const due = new Date(this.dueDate);
  const diffTime = today - due;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});

// Virtual for is overdue
invoiceSchema.virtual('isOverdue').get(function() {
  if (['paid', 'cancelled', 'refunded'].includes(this.status)) return false;
  return new Date() > new Date(this.dueDate) && this.summary.amountDue > 0;
});

// Pre-save hook to generate invoice ID
invoiceSchema.pre('save', async function(next) {
  if (!this.invoiceId) {
    const Counter = require('./Counter');
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const invCounterId = `invoice-${year}${month}`;
    const sequence = await Counter.getNextSequence(invCounterId);
    this.invoiceId = `INV${year}${month}${String(sequence).padStart(6, '0')}`;
  }

  // Set due date if not provided (default 30 days)
  if (!this.dueDate) {
    this.dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  // Calculate summary totals
  if (this.items && this.items.length > 0) {
    this.summary.subtotal = this.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    this.summary.discountTotal = this.items.reduce((sum, item) => sum + (item.discount || 0), 0);
    this.summary.taxTotal = this.items.reduce((sum, item) => sum + (item.tax || 0), 0);
    this.summary.total = this.items.reduce((sum, item) => sum + (item.total || 0), 0);
  }

  // Calculate amount paid
  if (this.payments && this.payments.length > 0) {
    this.summary.amountPaid = this.payments.reduce((sum, payment) => sum + payment.amount, 0);
  }

  // Calculate amount due
  this.summary.amountDue = this.summary.total - this.summary.amountPaid;

  // Auto-update status based on payment
  if (this.summary.amountDue <= 0 && this.summary.total > 0) {
    this.status = 'paid';
    if (!this.paidDate) {
      this.paidDate = new Date();
    }
  } else if (this.summary.amountPaid > 0 && this.summary.amountDue > 0) {
    this.status = 'partial';
  } else if (this.isOverdue && this.status !== 'cancelled') {
    this.status = 'overdue';
  }

  next();
});

// Method to add payment
invoiceSchema.methods.addPayment = async function(paymentData, userId, session = null) {
  const paymentId = `PAY${Date.now()}${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

  const payment = {
    paymentId,
    amount: paymentData.amount,
    method: paymentData.method,
    date: paymentData.date || new Date(),
    reference: paymentData.reference,
    notes: paymentData.notes,
    receivedBy: userId
  };

  this.payments.push(payment);
  this.updatedBy = userId;

  await this.save(session ? { session } : {});

  return payment;
};

// Method to cancel invoice
invoiceSchema.methods.cancel = async function(userId, reason, session = null) {
  if (this.summary.amountPaid > 0) {
    throw new Error('Cannot cancel invoice with payments. Please refund first.');
  }

  this.status = 'cancelled';
  this.cancellation = {
    cancelled: true,
    cancelledAt: new Date(),
    cancelledBy: userId,
    reason
  };
  this.updatedBy = userId;

  await this.save(session ? { session } : {});
};

// Method to issue refund
invoiceSchema.methods.issueRefund = async function(amount, userId, reason, method, session = null) {
  if (amount > this.summary.amountPaid) {
    throw new Error('Refund amount cannot exceed amount paid');
  }

  this.refund = {
    refunded: true,
    refundedAt: new Date(),
    refundedBy: userId,
    amount,
    reason,
    method
  };

  // Create negative payment record for audit trail
  const refundPaymentId = `REF${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  this.payments.push({
    paymentId: refundPaymentId,
    amount: -amount,  // Negative for refund
    method: method || 'refund',
    date: new Date(),
    reference: `Refund: ${reason}`,
    notes: reason,
    receivedBy: userId
  });

  this.summary.amountPaid -= amount;
  this.summary.amountDue += amount;

  if (this.summary.amountDue >= this.summary.total) {
    this.status = 'refunded';
  } else {
    this.status = 'partial';
  }

  this.updatedBy = userId;

  await this.save(session ? { session } : {});
};

// Method to send reminder
invoiceSchema.methods.sendReminder = async function(method, userId, session = null) {
  this.reminders.push({
    sentDate: new Date(),
    method,
    sentBy: userId
  });

  await this.save(session ? { session } : {});
};

// Static method to get overdue invoices
invoiceSchema.statics.getOverdueInvoices = async function() {
  const today = new Date();
  return this.find({
    status: { $in: ['issued', 'sent', 'viewed', 'partial'] },
    dueDate: { $lt: today },
    'summary.amountDue': { $gt: 0 }
  }).populate('patient', 'firstName lastName patientId phoneNumber email');
};

// Static method to get patient balance
invoiceSchema.statics.getPatientBalance = async function(patientId) {
  const invoices = await this.find({
    patient: patientId,
    status: { $nin: ['cancelled', 'refunded'] }
  });

  const total = invoices.reduce((sum, inv) => sum + inv.summary.total, 0);
  const paid = invoices.reduce((sum, inv) => sum + inv.summary.amountPaid, 0);
  const due = invoices.reduce((sum, inv) => sum + inv.summary.amountDue, 0);

  return { total, paid, due };
};

module.exports = mongoose.model('Invoice', invoiceSchema);
