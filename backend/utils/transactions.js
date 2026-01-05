/**
 * MongoDB Transaction Utilities
 *
 * Provides helpers for running operations within transactions
 * to prevent race conditions and ensure data consistency.
 *
 * IMPORTANT: Requires MongoDB replica set to be enabled.
 */

const mongoose = require('mongoose');
const { createContextLogger } = require('./structuredLogger');
const log = createContextLogger('Transactions');

// Cache for transaction support check
let _transactionsSupported = null;

/**
 * Check if MongoDB supports transactions (replica set required)
 * Results are cached after first check
 */
async function isTransactionSupported() {
  if (_transactionsSupported !== null) {
    return _transactionsSupported;
  }

  try {
    // Try to start a session and transaction
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await session.abortTransaction();
      _transactionsSupported = true;
      log.info('MongoDB transactions supported (replica set detected)');
    } catch (error) {
      if (error.message?.includes('replica set') ||
          error.message?.includes('Transaction numbers')) {
        _transactionsSupported = false;
        log.warn('MongoDB transactions NOT supported - running in standalone mode. Payments will work without transactions.');
      } else {
        throw error;
      }
    } finally {
      session.endSession();
    }
  } catch (error) {
    log.warn('Could not check transaction support:', { error: error.message });
    _transactionsSupported = false;
  }

  return _transactionsSupported;
}

/**
 * Execute a function within a MongoDB transaction
 *
 * @param {Function} operation - Async function that receives the session
 * @param {Object} options - Transaction options
 * @returns {Promise<any>} - Result of the operation
 *
 * @example
 * const result = await withTransaction(async (session) => {
 *   const patient = await Patient.findById(patientId).session(session);
 *   patient.balance -= amount;
 *   await patient.save({ session });
 *
 *   const invoice = new Invoice({ patient: patientId, amount });
 *   await invoice.save({ session });
 *
 *   return invoice;
 * });
 */
async function withTransaction(operation, options = {}) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      ...options
    });

    const result = await operation(session);

    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Execute a function with retry logic for transient transaction errors
 *
 * Falls back to non-transactional execution when MongoDB is running in standalone mode.
 *
 * @param {Function} operation - Async function that receives the session (may be null in standalone mode)
 * @param {Object} options - Options including maxRetries
 * @returns {Promise<any>} - Result of the operation
 */
async function withTransactionRetry(operation, options = {}) {
  const { maxRetries = 3, ...txOptions } = options;

  // Check if transactions are supported
  const txSupported = await isTransactionSupported();

  if (!txSupported) {
    // Standalone mode: run without transaction
    // Pass null as session - callers should handle null session gracefully
    log.debug('Running operation without transaction (standalone mode)');
    return await operation(null);
  }

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await withTransaction(operation, txOptions);
    } catch (error) {
      lastError = error;

      // Check if error indicates standalone mode (shouldn't happen now, but just in case)
      if (error.message?.includes('replica set') ||
          error.message?.includes('Transaction numbers')) {
        log.warn('Transaction failed due to standalone mode, running without transaction');
        _transactionsSupported = false;
        return await operation(null);
      }

      // Check if error is retryable
      const isRetryable =
        error.hasErrorLabel?.('TransientTransactionError') ||
        error.code === 112 || // WriteConflict
        error.code === 251 || // NoSuchTransaction
        error.message?.includes('WriteConflict');

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);
      await new Promise(resolve => setTimeout(resolve, delay));

      log.warn(`Transaction retry attempt ${attempt + 1}/${maxRetries} after error:`, { error: error.message });
    }
  }

  throw lastError;
}

/**
 * Atomic inventory update with optimistic locking
 *
 * Prevents race conditions when updating inventory quantities
 *
 * @param {string} inventoryId - Inventory document ID
 * @param {number} quantityChange - Amount to add (positive) or remove (negative)
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Updated inventory document
 */
async function atomicInventoryUpdate(inventoryId, quantityChange, options = {}) {
  const { session, reason, userId } = options;
  const { PharmacyInventory } = require('../models/Inventory');

  // Use findOneAndUpdate with conditions to prevent negative stock
  const updateQuery = {
    _id: inventoryId
  };

  // If reducing stock, ensure we have enough
  if (quantityChange < 0) {
    updateQuery['inventory.currentStock'] = { $gte: Math.abs(quantityChange) };
  }

  const result = await PharmacyInventory.findOneAndUpdate(
    updateQuery,
    {
      $inc: { 'inventory.currentStock': quantityChange },
      $push: {
        stockHistory: {
          date: new Date(),
          type: quantityChange > 0 ? 'addition' : 'dispensing',
          quantity: Math.abs(quantityChange),
          reason: reason || 'Stock update',
          performedBy: userId
        }
      }
    },
    {
      new: true,
      session,
      runValidators: true
    }
  );

  if (!result && quantityChange < 0) {
    throw new Error('Insufficient stock for this operation');
  }

  if (!result) {
    throw new Error('Inventory item not found');
  }

  return result;
}

/**
 * Atomic batch stock update (FIFO - First In, First Out)
 *
 * Dispenses from oldest batches first
 *
 * @param {string} inventoryId - Inventory document ID
 * @param {number} quantity - Quantity to dispense
 * @param {mongoose.ClientSession} session - MongoDB session
 * @returns {Promise<Object>} - Updated inventory and batch details
 */
async function dispenseBatchFIFO(inventoryId, quantity, session) {
  const { PharmacyInventory } = require('../models/Inventory');

  const inventory = await PharmacyInventory.findById(inventoryId).session(session);

  if (!inventory) {
    throw new Error('Inventory item not found');
  }

  // Sort batches by expiration date (FEFO - First Expiry, First Out)
  const activeBatches = inventory.batches
    .filter(b => b.status === 'active' && b.quantity > 0)
    .sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));

  let remainingToDispense = quantity;
  const dispensedFrom = [];

  for (const batch of activeBatches) {
    if (remainingToDispense <= 0) break;

    const available = batch.quantity - (batch.reserved || 0);
    const toDispense = Math.min(available, remainingToDispense);

    if (toDispense > 0) {
      batch.quantity -= toDispense;
      remainingToDispense -= toDispense;

      dispensedFrom.push({
        lotNumber: batch.lotNumber,
        quantity: toDispense,
        expirationDate: batch.expirationDate
      });

      // Mark batch as depleted if empty
      if (batch.quantity <= 0) {
        batch.status = 'depleted';
      }
    }
  }

  if (remainingToDispense > 0) {
    throw new Error(`Insufficient stock. Short by ${remainingToDispense} units.`);
  }

  // Update total stock
  inventory.inventory.currentStock -= quantity;

  // Update status based on stock levels
  if (inventory.inventory.currentStock <= 0) {
    inventory.inventory.status = 'out-of-stock';
  } else if (inventory.inventory.currentStock <= inventory.inventory.minimumStock) {
    inventory.inventory.status = 'low-stock';
  }

  await inventory.save({ session });

  return {
    inventory,
    dispensedFrom
  };
}

/**
 * Atomic appointment slot booking
 *
 * Prevents double-booking of time slots
 *
 * @param {Object} appointmentData - Appointment details
 * @param {mongoose.ClientSession} session - MongoDB session
 * @returns {Promise<Object>} - Created appointment
 */
async function bookAppointmentSlot(appointmentData, session) {
  const Appointment = require('../models/Appointment');

  const { provider, date, startTime, endTime } = appointmentData;

  // Check for existing appointments in the same slot
  const existingAppointment = await Appointment.findOne({
    provider,
    date: {
      $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
      $lt: new Date(new Date(date).setHours(23, 59, 59, 999))
    },
    status: { $nin: ['cancelled', 'rescheduled'] },
    $or: [
      // New appointment starts during existing
      {
        startTime: { $lte: startTime },
        endTime: { $gt: startTime }
      },
      // New appointment ends during existing
      {
        startTime: { $lt: endTime },
        endTime: { $gte: endTime }
      },
      // New appointment contains existing
      {
        startTime: { $gte: startTime },
        endTime: { $lte: endTime }
      }
    ]
  }).session(session);

  if (existingAppointment) {
    throw new Error('Time slot is already booked');
  }

  // Create the appointment
  const appointment = new Appointment(appointmentData);
  await appointment.save({ session });

  return appointment;
}

/**
 * Atomic payment processing
 *
 * Ensures invoice and payment records are consistent
 *
 * @param {Object} paymentData - Payment details
 * @param {mongoose.ClientSession} session - MongoDB session
 * @returns {Promise<Object>} - Payment result
 */
async function processPayment(paymentData, session) {
  const Invoice = require('../models/Invoice');

  const { invoiceId, amount, method, reference, processedBy } = paymentData;

  // Find and lock the invoice
  const invoice = await Invoice.findById(invoiceId).session(session);

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  if (invoice.status === 'paid') {
    throw new Error('Invoice is already paid');
  }

  if (invoice.status === 'cancelled' || invoice.status === 'voided') {
    throw new Error('Cannot pay a cancelled or voided invoice');
  }

  const balance = invoice.summary.total - invoice.summary.amountPaid;

  if (amount > balance) {
    throw new Error(`Payment amount (${amount}) exceeds balance (${balance})`);
  }

  // Add payment record
  invoice.payments.push({
    date: new Date(),
    amount,
    method,
    reference,
    processedBy,
    status: 'completed'
  });

  // Update amounts
  invoice.summary.amountPaid += amount;
  invoice.summary.balance = invoice.summary.total - invoice.summary.amountPaid;

  // Update status
  if (invoice.summary.balance <= 0) {
    invoice.status = 'paid';
  } else {
    invoice.status = 'partial';
  }

  await invoice.save({ session });

  return {
    invoice,
    payment: invoice.payments[invoice.payments.length - 1],
    remainingBalance: invoice.summary.balance
  };
}

/**
 * Atomic prescription dispensing
 *
 * Updates prescription status and inventory in a single transaction
 *
 * @param {string} prescriptionId - Prescription ID
 * @param {Array} items - Items to dispense with quantities
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Dispensing result
 */
async function dispensePrescription(prescriptionId, items, options = {}) {
  const Prescription = require('../models/Prescription');
  const { PharmacyInventory } = require('../models/Inventory');

  return withTransactionRetry(async (session) => {
    const prescription = await Prescription.findById(prescriptionId).session(session);

    if (!prescription) {
      throw new Error('Prescription not found');
    }

    if (prescription.status === 'dispensed') {
      throw new Error('Prescription has already been fully dispensed');
    }

    const dispensedItems = [];

    // Process each item
    for (const item of items) {
      const { medicationId, quantity } = item;

      // Update inventory
      const inventoryResult = await dispenseBatchFIFO(medicationId, quantity, session);

      dispensedItems.push({
        medication: medicationId,
        quantity,
        batches: inventoryResult.dispensedFrom
      });
    }

    // Update prescription status
    prescription.status = 'dispensed';
    prescription.dispensedAt = new Date();
    prescription.dispensedBy = options.userId;
    prescription.dispensingHistory = prescription.dispensingHistory || [];
    prescription.dispensingHistory.push({
      date: new Date(),
      items: dispensedItems,
      dispensedBy: options.userId
    });

    await prescription.save({ session });

    return {
      prescription,
      dispensedItems
    };
  }, { maxRetries: 3 });
}

/**
 * Check if MongoDB supports transactions (replica set required)
 */
async function checkTransactionSupport() {
  try {
    const admin = mongoose.connection.db.admin();
    const info = await admin.serverStatus();

    // Check if running with replica set
    const hasReplicaSet = info.repl || process.env.MONGODB_URI?.includes('replicaSet');

    if (!hasReplicaSet) {
      console.warn('⚠️  MongoDB transactions require a replica set. Some features may not work correctly.');
      return false;
    }

    return true;
  } catch (error) {
    console.warn('Could not check transaction support:', error.message);
    return false;
  }
}

/**
 * Atomic multi-invoice payment allocation
 *
 * Allocates a single payment across multiple invoices with rollback on failure
 *
 * @param {Object} params - Payment allocation parameters
 * @param {Object} params.invoiceAllocations - Array of { invoice, amount }
 * @param {Object} params.paymentDetails - Payment details (method, reference, currency, etc.)
 * @param {string} params.userId - User ID processing the payment
 * @param {string} params.batchPaymentId - Batch payment identifier
 * @returns {Promise<Object>} - Allocation results
 */
async function atomicMultiInvoicePayment(params) {
  const { invoiceAllocations, paymentDetails, userId, batchPaymentId } = params;
  const {
    validateAmount,
    roundToDecimals,
    CURRENCY_CONFIG
  } = require('./financialValidation');

  return withTransactionRetry(async (session) => {
    const results = [];
    let totalAllocated = 0;

    for (const { invoice, amount } of invoiceAllocations) {
      if (amount <= 0) continue;

      // Validate amount
      const validation = validateAmount(amount, {
        currency: paymentDetails.currency || 'CDF',
        allowZero: false,
        fieldName: 'Allocation amount'
      });

      if (!validation.valid) {
        throw new Error(`Invalid allocation for invoice ${invoice.invoiceId}: ${validation.error}`);
      }

      const sanitizedAmount = validation.sanitized;

      // Verify invoice hasn't been modified (optimistic locking)
      const currentInvoice = await invoice.constructor.findById(invoice._id).session(session);
      if (!currentInvoice) {
        throw new Error(`Invoice ${invoice.invoiceId} not found`);
      }

      if (currentInvoice.version !== invoice.version) {
        throw new Error(`Invoice ${invoice.invoiceId} was modified by another user. Please refresh.`);
      }

      // Verify amount due hasn't changed
      if (currentInvoice.summary.amountDue < sanitizedAmount - 0.01) {
        throw new Error(
          `Invoice ${invoice.invoiceId} amount due changed from ${invoice.summary.amountDue} to ${currentInvoice.summary.amountDue}`
        );
      }

      // Create payment record
      const paymentId = `${batchPaymentId}-${currentInvoice._id.toString().slice(-4)}`;

      const decimals = CURRENCY_CONFIG[paymentDetails.currency]?.decimals ?? 2;
      const amountInBaseCurrency = paymentDetails.currency === 'CDF'
        ? sanitizedAmount
        : roundToDecimals(sanitizedAmount * (paymentDetails.exchangeRate || 1), 0);

      currentInvoice.payments.push({
        paymentId,
        amount: sanitizedAmount,
        currency: paymentDetails.currency || 'CDF',
        amountInBaseCurrency,
        exchangeRate: paymentDetails.exchangeRate || 1,
        method: paymentDetails.method,
        date: new Date(),
        reference: paymentDetails.reference || `Batch payment: ${batchPaymentId}`,
        notes: paymentDetails.notes || `Allocated from batch payment ${batchPaymentId}`,
        receivedBy: userId,
        batchPaymentId
      });

      // Record edit history
      if (currentInvoice.recordEdit) {
        currentInvoice.recordEdit('payment_added', {
          paymentId,
          amount: sanitizedAmount,
          currency: paymentDetails.currency || 'CDF',
          method: paymentDetails.method,
          batchPaymentId
        }, {
          amountPaid: currentInvoice.summary.amountPaid,
          amountDue: currentInvoice.summary.amountDue,
          status: currentInvoice.status
        }, userId, 'Multi-invoice payment allocation');
      }

      currentInvoice.updatedBy = userId;
      await currentInvoice.save({ session });

      results.push({
        invoiceId: currentInvoice.invoiceId,
        paymentId,
        allocatedAmount: sanitizedAmount,
        previousAmountDue: invoice.summary.amountDue,
        newAmountDue: currentInvoice.summary.amountDue,
        newStatus: currentInvoice.status
      });

      totalAllocated += sanitizedAmount;
    }

    return {
      success: true,
      results,
      totalAllocated
    };
  }, { maxRetries: 3 });
}

/**
 * Atomic refund processing
 *
 * Processes a refund with proper rollback on failure
 *
 * @param {Object} params - Refund parameters
 * @param {Object} params.invoice - Invoice document
 * @param {number} params.amount - Refund amount
 * @param {string} params.reason - Refund reason
 * @param {string} params.method - Refund method
 * @param {string} params.userId - User ID processing the refund
 * @param {Object} params.options - Additional options
 * @returns {Promise<Object>} - Refund result
 */
async function atomicRefund(params) {
  const { invoice, amount, reason, method, userId, options = {} } = params;

  return withTransactionRetry(async (session) => {
    // Reload invoice with session
    const currentInvoice = await invoice.constructor.findById(invoice._id).session(session);

    if (!currentInvoice) {
      throw new Error('Invoice not found');
    }

    // Check optimistic lock
    if (options.expectedVersion !== undefined && currentInvoice.version !== options.expectedVersion) {
      throw new Error(
        `Invoice was modified. Expected version ${options.expectedVersion}, current ${currentInvoice.version}`
      );
    }

    // Process refund using the model method
    const result = await currentInvoice.issueRefund(amount, userId, reason, method, session, options);

    return result;
  }, { maxRetries: 2 });
}

module.exports = {
  withTransaction,
  withTransactionRetry,
  isTransactionSupported,
  atomicInventoryUpdate,
  dispenseBatchFIFO,
  bookAppointmentSlot,
  processPayment,
  dispensePrescription,
  checkTransactionSupport,
  atomicMultiInvoicePayment,
  atomicRefund
};
