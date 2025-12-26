const mongoose = require('mongoose');
const crypto = require('crypto');

const paymentPlanSchema = new mongoose.Schema({
  planId: {
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
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic is required for multi-tenant isolation'],
    index: true
  },
  invoices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  downPayment: {
    amount: { type: Number, default: 0 },
    dueDate: Date,
    paidDate: Date,
    paid: { type: Boolean, default: false }
  },
  installments: [{
    number: Number,
    amount: Number,
    originalAmount: Number, // Amount before late fee
    dueDate: Date,
    status: {
      type: String,
      enum: ['pending', 'paid', 'overdue', 'partially-paid', 'waived'],
      default: 'pending'
    },
    paidAmount: { type: Number, default: 0 },
    paidDate: Date,
    paymentId: String,
    notes: String,
    // Late fee tracking
    lateFeeApplied: { type: Boolean, default: false },
    lateFeeAmount: { type: Number, default: 0 },
    lateFeeDate: Date,
    lateFeeWaived: { type: Boolean, default: false },
    lateFeeWaivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lateFeeWaivedReason: String,
    // Auto-charge tracking
    lastAutoChargeAttempt: Date,
    autoChargeFailures: { type: Number, default: 0 },
    autoChargeTransactionId: String,
    autoChargeError: String
  }],
  frequency: {
    type: String,
    enum: ['weekly', 'biweekly', 'monthly', 'custom'],
    default: 'monthly'
  },
  numberOfInstallments: {
    type: Number,
    required: true,
    min: 2
  },
  interestRate: {
    type: Number,
    default: 0,
    min: 0
  },
  lateFee: {
    type: Number,
    default: 0
  },
  gracePeriodDays: {
    type: Number,
    default: 5
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: Date,
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'defaulted', 'cancelled'],
    default: 'draft',
    index: true
  },
  autoPayment: {
    enabled: { type: Boolean, default: false },
    paymentMethodId: String,
    notifyBeforeDays: { type: Number, default: 3 },
    // Tracking when auto-pay is disabled
    disabledReason: String,
    disabledAt: Date,
    disabledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Last successful auto-charge
    lastSuccessfulCharge: Date,
    lastSuccessfulAmount: Number,
    // Total auto-charged
    totalAutoCharged: { type: Number, default: 0 },
    autoChargeCount: { type: Number, default: 0 }
  },
  reminders: [{
    sentDate: Date,
    method: String,
    installmentNumber: Number
  }],
  notes: String,
  terms: String,
  signedAt: Date,
  signatureData: String,
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

paymentPlanSchema.index({ planId: 1 }, { unique: true });
paymentPlanSchema.index({ clinic: 1, status: 1, createdAt: -1 });
paymentPlanSchema.index({ clinic: 1, patient: 1, status: 1 });
paymentPlanSchema.index({ patient: 1, status: 1 });

paymentPlanSchema.virtual('remainingBalance').get(function() {
  const paid = this.installments.reduce((sum, inst) => sum + (inst.paidAmount || 0), 0);
  const downPaid = this.downPayment.paid ? this.downPayment.amount : 0;
  return this.totalAmount - paid - downPaid;
});

paymentPlanSchema.virtual('paidAmount').get(function() {
  const paid = this.installments.reduce((sum, inst) => sum + (inst.paidAmount || 0), 0);
  const downPaid = this.downPayment.paid ? this.downPayment.amount : 0;
  return paid + downPaid;
});

paymentPlanSchema.virtual('nextDueInstallment').get(function() {
  return this.installments.find(inst => inst.status === 'pending' || inst.status === 'overdue');
});

paymentPlanSchema.pre('save', async function(next) {
  if (!this.planId) {
    const year = new Date().getFullYear();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    this.planId = `PP${year}${random}`;
  }

  // Check for overdue installments and apply late fees
  const now = new Date();
  const gracePeriodMs = (this.gracePeriodDays || 0) * 24 * 60 * 60 * 1000;

  this.installments.forEach(inst => {
    if (inst.status === 'pending') {
      const dueDate = new Date(inst.dueDate);
      const gracePeriodEnd = new Date(dueDate.getTime() + gracePeriodMs);

      if (now > gracePeriodEnd) {
        // Mark as overdue
        inst.status = 'overdue';

        // Apply late fee if not already applied and lateFee is configured
        if (this.lateFee > 0 && !inst.lateFeeApplied) {
          inst.lateFeeAmount = this.lateFee;
          inst.lateFeeApplied = true;
          inst.lateFeeDate = now;
          // Late fee increases the amount due for this installment
          inst.amount = (inst.originalAmount || inst.amount) + this.lateFee;
          if (!inst.originalAmount) {
            inst.originalAmount = inst.amount - this.lateFee;
          }
        }
      }
    }
  });

  // Calculate end date based on last installment
  if (this.installments.length > 0) {
    const lastInstallment = this.installments[this.installments.length - 1];
    this.endDate = lastInstallment.dueDate;
  }

  // Check if plan is completed
  const allPaid = this.installments.every(inst => inst.status === 'paid' || inst.status === 'waived');
  if (allPaid && this.status === 'active') {
    this.status = 'completed';
  }

  next();
});

paymentPlanSchema.methods.generateInstallments = function() {
  const installmentAmount = Math.floor((this.totalAmount - this.downPayment.amount) / this.numberOfInstallments);
  const remainder = (this.totalAmount - this.downPayment.amount) % this.numberOfInstallments;

  this.installments = [];
  const currentDate = new Date(this.startDate);

  for (let i = 0; i < this.numberOfInstallments; i++) {
    let amount = installmentAmount;
    if (i === this.numberOfInstallments - 1) {
      amount += remainder; // Add remainder to last installment
    }

    // Apply interest if any
    if (this.interestRate > 0) {
      amount += Math.round(amount * (this.interestRate / 100));
    }

    this.installments.push({
      number: i + 1,
      amount,
      dueDate: new Date(currentDate),
      status: 'pending',
      paidAmount: 0
    });

    // Move to next date based on frequency
    switch (this.frequency) {
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'biweekly':
        currentDate.setDate(currentDate.getDate() + 14);
        break;
      case 'monthly':
      default:
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
    }
  }

  return this.installments;
};

paymentPlanSchema.methods.recordPayment = async function(installmentNumber, amount, paymentId, userId) {
  const installment = this.installments.find(inst => inst.number === installmentNumber);
  if (!installment) {
    throw new Error('Installment not found');
  }

  installment.paidAmount = (installment.paidAmount || 0) + amount;
  installment.paymentId = paymentId;

  if (installment.paidAmount >= installment.amount) {
    installment.status = 'paid';
    installment.paidDate = new Date();
  } else {
    installment.status = 'partially-paid';
  }

  this.updatedBy = userId;
  await this.save();

  // Sync payment to linked invoices (distribute payment proportionally)
  if (this.invoices && this.invoices.length > 0) {
    await this.syncPaymentToInvoices(amount, paymentId, userId);
  }

  return installment;
};

// Sync payment plan payments to linked invoices
paymentPlanSchema.methods.syncPaymentToInvoices = async function(paymentAmount, paymentId, userId) {
  const Invoice = require('./Invoice');

  // Get all linked invoices with outstanding balance
  const invoices = await Invoice.find({
    _id: { $in: this.invoices },
    'summary.amountDue': { $gt: 0 }
  }).sort('dateIssued'); // Pay oldest invoices first

  let remainingPayment = paymentAmount;

  for (const invoice of invoices) {
    if (remainingPayment <= 0) break;

    const amountToApply = Math.min(remainingPayment, invoice.summary.amountDue);

    if (amountToApply > 0) {
      const crypto = require('crypto');
      const invoicePaymentId = `PP${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      invoice.payments.push({
        paymentId: invoicePaymentId,
        amount: amountToApply,
        method: 'payment_plan',
        reference: `${this.planId} - Installment payment`,
        notes: `Payment plan payment (Original Payment ID: ${paymentId || 'N/A'})`,
        date: new Date(),
        receivedBy: userId
      });

      invoice.summary.amountPaid += amountToApply;
      invoice.summary.amountDue = Math.max(0, invoice.summary.amountDue - amountToApply);

      if (invoice.summary.amountDue <= 0) {
        invoice.status = 'paid';
      } else if (invoice.summary.amountPaid > 0) {
        invoice.status = 'partial';
      }

      invoice.updatedBy = userId;
      await invoice.save();

      remainingPayment -= amountToApply;
    }
  }

  return { applied: paymentAmount - remainingPayment, remaining: remainingPayment };
};

paymentPlanSchema.methods.activate = async function(userId) {
  if (this.status !== 'draft') {
    throw new Error('Can only activate draft plans');
  }

  if (this.installments.length === 0) {
    this.generateInstallments();
  }

  this.status = 'active';
  this.updatedBy = userId;
  await this.save();

  return this;
};

paymentPlanSchema.statics.getActiveByPatient = function(patientId) {
  return this.find({ patient: patientId, status: 'active' })
    .populate('invoices', 'invoiceId summary')
    .sort('-createdAt');
};

paymentPlanSchema.statics.getOverdueInstallments = async function() {
  return this.aggregate([
    { $match: { status: 'active' } },
    { $unwind: '$installments' },
    { $match: { 'installments.status': 'overdue' } },
    {
      $lookup: {
        from: 'patients',
        localField: 'patient',
        foreignField: '_id',
        as: 'patientInfo'
      }
    },
    {
      $project: {
        planId: 1,
        installment: '$installments',
        patient: { $arrayElemAt: ['$patientInfo', 0] }
      }
    }
  ]);
};

// Method to waive late fee for a specific installment
paymentPlanSchema.methods.waiveLateFee = async function(installmentNumber, userId, reason) {
  const installment = this.installments.find(inst => inst.number === installmentNumber);
  if (!installment) {
    throw new Error('Installment not found');
  }

  if (!installment.lateFeeApplied) {
    throw new Error('No late fee has been applied to this installment');
  }

  if (installment.lateFeeWaived) {
    throw new Error('Late fee has already been waived');
  }

  // Restore original amount
  if (installment.originalAmount) {
    installment.amount = installment.originalAmount;
  } else {
    installment.amount = installment.amount - (installment.lateFeeAmount || 0);
  }

  installment.lateFeeWaived = true;
  installment.lateFeeWaivedBy = userId;
  installment.lateFeeWaivedReason = reason;

  this.updatedBy = userId;
  await this.save();

  return installment;
};

// Static method to process all overdue installments and apply late fees (for scheduled jobs)
paymentPlanSchema.statics.processOverdueLateFees = async function() {
  const now = new Date();
  const activePlans = await this.find({
    status: 'active',
    lateFee: { $gt: 0 }
  });

  const results = {
    processed: 0,
    lateFeesApplied: 0,
    errors: []
  };

  for (const plan of activePlans) {
    try {
      const gracePeriodMs = (plan.gracePeriodDays || 0) * 24 * 60 * 60 * 1000;
      let modified = false;

      for (const inst of plan.installments) {
        if (inst.status === 'pending' || inst.status === 'overdue') {
          const dueDate = new Date(inst.dueDate);
          const gracePeriodEnd = new Date(dueDate.getTime() + gracePeriodMs);

          if (now > gracePeriodEnd && !inst.lateFeeApplied) {
            inst.status = 'overdue';
            inst.lateFeeAmount = plan.lateFee;
            inst.lateFeeApplied = true;
            inst.lateFeeDate = now;
            inst.originalAmount = inst.originalAmount || inst.amount;
            inst.amount = inst.originalAmount + plan.lateFee;
            modified = true;
            results.lateFeesApplied++;
          }
        }
      }

      if (modified) {
        await plan.save();
        results.processed++;
      }
    } catch (err) {
      results.errors.push({ planId: plan.planId, error: err.message });
    }
  }

  return results;
};

// Get total late fees collected
paymentPlanSchema.statics.getLateFeesSummary = async function(startDate, endDate) {
  const match = { status: { $in: ['active', 'completed'] } };

  const result = await this.aggregate([
    { $match: match },
    { $unwind: '$installments' },
    {
      $match: {
        'installments.lateFeeApplied': true,
        'installments.lateFeeDate': {
          $gte: startDate ? new Date(startDate) : new Date(0),
          $lte: endDate ? new Date(endDate) : new Date()
        }
      }
    },
    {
      $group: {
        _id: null,
        totalLateFees: { $sum: '$installments.lateFeeAmount' },
        totalWaived: {
          $sum: {
            $cond: ['$installments.lateFeeWaived', '$installments.lateFeeAmount', 0]
          }
        },
        count: { $sum: 1 }
      }
    }
  ]);

  return result[0] || { totalLateFees: 0, totalWaived: 0, count: 0 };
};

module.exports = mongoose.model('PaymentPlan', paymentPlanSchema);
