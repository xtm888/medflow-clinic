/**
 * Prescription Dispense Service
 *
 * Extracted from Invoice.js model to handle automatic prescription dispensing
 * when invoices are paid. This service manages inventory deduction, dispensing
 * records, and prescription status updates.
 *
 * Uses two-level locking for race condition prevention:
 * 1. Distributed lock (Redis) - prevents concurrent dispense across server instances
 * 2. Atomic MongoDB lock - prevents concurrent dispense within same server
 *
 * @module services/prescriptionDispenseService
 */

const mongoose = require('mongoose');
const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('PrescriptionDispenseService');

// Import distributed lock for cross-instance coordination
const { withLock } = require('./distributedLock');

// Import transaction utilities
const { withTransactionRetry } = require('../utils/transactions');

/**
 * Find prescriptions linked to an invoice for auto-dispensing
 *
 * Uses multiple strategies:
 * 1. Invoice item references (Prescription:xxx or ObjectId)
 * 2. Linked visit's prescriptions
 * 3. Direct prescription link on invoice
 * 4. Search prescriptions from same visit (with medication items)
 *
 * @param {Object} invoice - Invoice document
 * @returns {Promise<Set<string>>} Set of prescription IDs to dispense
 */
async function findPrescriptionsForInvoice(invoice) {
  const Prescription = mongoose.model('Prescription');
  const Visit = mongoose.model('Visit');

  const prescriptionsToDispense = new Set();

  // Method 1: Find prescriptions from invoice item references
  if (invoice.items && invoice.items.length > 0) {
    const medicationItems = invoice.items.filter(item =>
      item.category === 'medication' ||
      (item.code && item.code.startsWith('MED_')) ||
      (item.description && /tablet|capsule|injection|drops|syrup|cream|gel|ointment/i.test(item.description))
    );

    if (medicationItems.length > 0) {
      log.debug('Found medication items on invoice', {
        invoiceId: invoice.invoiceId,
        count: medicationItems.length
      });
    }

    for (const item of medicationItems) {
      if (item.reference) {
        const ref = item.reference;
        if (ref.startsWith('Prescription:')) {
          prescriptionsToDispense.add(ref.replace('Prescription:', ''));
        } else if (mongoose.isValidObjectId(ref)) {
          prescriptionsToDispense.add(ref);
        }
      }
    }
  }

  // Method 2: Find prescriptions from linked visit
  if (invoice.visit) {
    try {
      const visit = await Visit.findById(invoice.visit).select('prescriptions');
      if (visit && visit.prescriptions && visit.prescriptions.length > 0) {
        for (const prescId of visit.prescriptions) {
          prescriptionsToDispense.add(prescId.toString());
        }
        log.debug('Found prescriptions from linked visit', {
          invoiceId: invoice.invoiceId,
          count: visit.prescriptions.length
        });
      }
    } catch (err) {
      log.error('Error fetching visit prescriptions', {
        invoiceId: invoice.invoiceId,
        error: err.message
      });
    }
  }

  // Method 3: Find prescriptions directly linked to this invoice
  if (invoice.prescription) {
    prescriptionsToDispense.add(invoice.prescription.toString());
  }

  // Method 4: SAFETY FIX - Only search for prescriptions from the SAME VISIT
  // Previously this could accidentally dispense prescriptions from unrelated visits
  // Now it REQUIRES a linked visit and ONLY searches that specific visit
  if (prescriptionsToDispense.size === 0 && invoice.patient && invoice.visit) {
    const hasMedicationItems = invoice.items?.some(item =>
      item.category === 'medication' ||
      (item.code && item.code.startsWith('MED_')) ||
      (item.description && /tablet|capsule|injection|drops|syrup|cream|gel|ointment/i.test(item.description))
    );

    if (hasMedicationItems) {
      log.debug('Medications on invoice but no prescription refs - searching prescriptions from same visit only', {
        invoiceId: invoice.invoiceId
      });

      try {
        // CRITICAL: Only search for prescriptions from the EXACT same visit
        // Do NOT fall back to searching all patient prescriptions
        const visitPrescriptions = await Prescription.find({
          patient: invoice.patient,
          visit: invoice.visit,
          type: 'medication',
          status: 'pending'
        }).select('_id prescriptionId');

        if (visitPrescriptions.length > 0) {
          log.debug('Found pending prescriptions from same visit', {
            invoiceId: invoice.invoiceId,
            count: visitPrescriptions.length
          });
          for (const p of visitPrescriptions) {
            prescriptionsToDispense.add(p._id.toString());
          }
        }
        // NOTE: No fallback! If no prescriptions found for this visit, don't search other visits
      } catch (err) {
        log.error('Error searching visit prescriptions', {
          invoiceId: invoice.invoiceId,
          error: err.message
        });
      }
    }
  }

  return prescriptionsToDispense;
}

/**
 * Acquire a lock on a prescription for auto-dispensing
 * Uses atomic findOneAndUpdate to prevent race conditions
 *
 * @param {string} prescriptionId - Prescription ID
 * @param {string} invoiceId - Invoice ID (for tracking)
 * @returns {Promise<Object|null>} Locked prescription or null if unavailable
 */
async function acquirePrescriptionLock(prescriptionId, invoiceId) {
  const Prescription = mongoose.model('Prescription');

  return await Prescription.findOneAndUpdate(
    {
      _id: prescriptionId,
      type: 'medication',
      status: { $nin: ['dispensed', 'cancelled'] },
      'autoDispenseInProgress': { $ne: true }
    },
    {
      $set: {
        autoDispenseInProgress: true,
        autoDispenseStartedAt: new Date(),
        autoDispenseInvoice: invoiceId
      }
    },
    { new: true }
  );
}

/**
 * Release the lock on a prescription (used on error)
 *
 * @param {string} prescriptionId - Prescription ID
 */
async function releasePrescriptionLock(prescriptionId) {
  const Prescription = mongoose.model('Prescription');

  await Prescription.findByIdAndUpdate(prescriptionId, {
    $unset: {
      autoDispenseInProgress: '',
      autoDispenseStartedAt: '',
      autoDispenseInvoice: ''
    }
  });
}

/**
 * Find inventory item for a medication
 *
 * @param {Object} medication - Medication from prescription
 * @returns {Promise<Object|null>} Inventory item or null
 */
async function findInventoryForMedication(medication) {
  const PharmacyInventory = mongoose.model('PharmacyInventory');

  // First try direct reference
  if (medication.inventoryItem) {
    const item = await PharmacyInventory.findById(medication.inventoryItem);
    if (item) return item;
  }

  // Try to find by medication name
  if (medication.name) {
    const escapedMedName = medication.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return await PharmacyInventory.findOne({
      $or: [
        { 'medication.genericName': { $regex: new RegExp(escapedMedName, 'i') } },
        { 'medication.brandName': { $regex: new RegExp(escapedMedName, 'i') } }
      ]
    });
  }

  return null;
}

/**
 * Deduct medication from inventory using atomic operation
 *
 * Uses pessimistic locking to prevent race conditions where two concurrent
 * prescriptions could deduct from the same inventory batch, causing count errors.
 *
 * @param {Object} inventoryItem - PharmacyInventory document
 * @param {number} quantity - Quantity to deduct
 * @param {Object} context - Context for dispensing record
 * @param {Object} [context.session] - Mongoose session for transaction support
 * @returns {Promise<boolean>} True if deduction successful
 */
async function deductInventory(inventoryItem, quantity, context) {
  const { Inventory } = require('../models/Inventory');
  const { prescription, invoice, userId, session } = context;

  try {
    // Use atomic deduction with pessimistic locking
    const metadata = {
      reason: 'Auto-dispensed on payment',
      reference: `Invoice:${invoice.invoiceId}|Prescription:${prescription._id}`,
      referenceType: 'prescription',
      performedBy: userId,
      notes: `Auto-dispensed for patient ${prescription.patient} via invoice ${invoice.invoiceId}`
    };

    const updatedItem = await Inventory.atomicDeduct(
      inventoryItem._id,
      quantity,
      metadata,
      session || null
    );

    log.debug('Atomically deducted medication from inventory', {
      invoiceId: invoice.invoiceId,
      inventoryId: inventoryItem._id.toString(),
      medication: inventoryItem.name || inventoryItem.genericName || 'unknown',
      quantity,
      remaining: updatedItem.inventory.currentStock,
      newStatus: updatedItem.inventory.status
    });

    return true;

  } catch (err) {
    // Handle specific error cases
    if (err.message.includes('Insufficient stock')) {
      log.warn('Insufficient stock for medication (atomic check)', {
        invoiceId: invoice.invoiceId,
        inventoryId: inventoryItem._id.toString(),
        medication: inventoryItem.name || inventoryItem.genericName || 'unknown',
        required: quantity,
        error: err.message
      });
      return false;
    }

    if (err.message.includes('locked by another operation')) {
      log.warn('Inventory locked by concurrent operation, will retry', {
        invoiceId: invoice.invoiceId,
        inventoryId: inventoryItem._id.toString(),
        medication: inventoryItem.name || inventoryItem.genericName || 'unknown',
        error: err.message
      });
      // Return false to indicate failure - caller can implement retry logic
      return false;
    }

    // Re-throw unexpected errors
    log.error('Unexpected error during atomic inventory deduction', {
      invoiceId: invoice.invoiceId,
      inventoryId: inventoryItem._id.toString(),
      error: err.message
    });
    throw err;
  }
}

/**
 * Dispense a single prescription
 *
 * @param {Object} prescription - Prescription document (with lock acquired)
 * @param {Object} invoice - Invoice document
 * @param {string} userId - User performing the dispense
 * @param {Object} [session] - Mongoose session for transaction support
 * @returns {Promise<Object>} Dispensing result
 */
async function dispenseSinglePrescription(prescription, invoice, userId, session = null) {
  const dispensingRecord = {
    dispensedAt: new Date(),
    dispensedBy: userId,
    notes: `Auto-dispensed on payment of invoice ${invoice.invoiceId}`,
    invoiceId: invoice._id,
    inventoryDeducted: false
  };

  let inventoryDeductedCount = 0;

  for (const medication of prescription.medications || []) {
    // Skip if already dispensed
    if (medication.dispensing?.dispensed) {
      continue;
    }

    const quantityToDispense = medication.quantity || 1;

    // Find and deduct inventory
    const inventoryItem = await findInventoryForMedication(medication);

    if (inventoryItem) {
      const deducted = await deductInventory(inventoryItem, quantityToDispense, {
        prescription,
        invoice,
        userId,
        session
      });
      if (deducted) {
        inventoryDeductedCount++;
      }
    }

    // Mark medication as dispensed in prescription
    medication.dispensing = {
      dispensed: true,
      dispensedQuantity: quantityToDispense,
      dispensedAt: new Date(),
      dispensedBy: userId,
      invoiceId: invoice._id
    };
  }

  // Update prescription status and clear the lock
  dispensingRecord.inventoryDeducted = inventoryDeductedCount > 0;
  prescription.dispensing = prescription.dispensing || [];
  prescription.dispensing.push(dispensingRecord);
  prescription.status = 'dispensed';
  prescription.dispensedAt = new Date();

  // Clear the auto-dispense lock fields
  prescription.autoDispenseInProgress = undefined;
  prescription.autoDispenseStartedAt = undefined;
  prescription.autoDispenseInvoice = undefined;

  await prescription.save();

  return {
    prescriptionId: prescription.prescriptionId || prescription._id.toString(),
    medicationsDispensed: prescription.medications?.length || 0,
    inventoryDeducted: inventoryDeductedCount
  };
}

/**
 * Auto-dispense prescriptions for a paid invoice
 *
 * This is the main entry point for automatic prescription dispensing.
 * It finds all prescriptions linked to the invoice and dispenses them
 * with proper inventory deduction and audit trail.
 *
 * Uses atomic inventory deduction with pessimistic locking to prevent
 * race conditions where concurrent dispensing operations could cause
 * inventory count errors.
 *
 * @param {Object} invoice - Invoice document
 * @param {Object} [options] - Options
 * @param {ClientSession} [options.session] - Mongoose session for transaction support
 * @returns {Promise<Object>} Dispensing results
 */
async function autoDispensePrescriptionsForInvoice(invoice, options = {}) {
  const { session } = options;
  const prescriptionsToDispense = await findPrescriptionsForInvoice(invoice);

  if (prescriptionsToDispense.size === 0) {
    log.debug('No prescriptions to auto-dispense', { invoiceId: invoice.invoiceId });
    return { dispensed: 0, skipped: 0, errors: 0 };
  }

  log.info('Auto-dispensing prescriptions after payment', {
    invoiceId: invoice.invoiceId,
    count: prescriptionsToDispense.size,
    usingSession: !!session
  });

  const userId = invoice.updatedBy || invoice.createdBy;
  let dispensed = 0;
  let skipped = 0;
  let errors = 0;

  for (const prescriptionId of prescriptionsToDispense) {
    try {
      // Acquire lock using atomic operation
      const prescription = await acquirePrescriptionLock(prescriptionId, invoice._id);

      if (!prescription) {
        // Either not found, already dispensed, or being processed by another
        log.debug('Prescription skipped (not found, already dispensed, or being processed)', {
          invoiceId: invoice.invoiceId,
          prescriptionId
        });
        skipped++;
        continue;
      }

      log.debug('Locked and dispensing prescription', {
        invoiceId: invoice.invoiceId,
        prescriptionId: prescription.prescriptionId || prescriptionId
      });

      const result = await dispenseSinglePrescription(prescription, invoice, userId, session);
      dispensed++;

      log.info('Successfully dispensed prescription', {
        invoiceId: invoice.invoiceId,
        prescriptionId: result.prescriptionId,
        medicationsDispensed: result.medicationsDispensed,
        inventoryDeducted: result.inventoryDeducted
      });

    } catch (err) {
      log.error('Error dispensing prescription', {
        invoiceId: invoice.invoiceId,
        prescriptionId,
        error: err.message
      });
      errors++;

      // CRITICAL: Release the lock on error so it can be retried
      try {
        await releasePrescriptionLock(prescriptionId);
      } catch (unlockErr) {
        log.error('Failed to release lock on prescription', {
          invoiceId: invoice.invoiceId,
          prescriptionId,
          error: unlockErr.message
        });
      }
    }
  }

  return { dispensed, skipped, errors };
}

/**
 * Dispense a prescription with distributed lock to prevent double-dispense
 *
 * This is the primary entry point for dispensing a single prescription.
 * Uses Redis distributed lock + MongoDB atomic lock for two-level protection:
 *
 * 1. Redis lock: Prevents concurrent dispense across multiple server instances
 * 2. MongoDB atomic lock: Prevents concurrent dispense within same server
 *
 * @param {string} prescriptionId - Prescription to dispense
 * @param {Array} items - Items to dispense [{medicationId, quantity, lotNumber}]
 * @param {Object} options - {userId, clinicId, invoiceId}
 * @returns {Promise<Object>} Dispensing result
 */
async function dispensePrescription(prescriptionId, items, options = {}) {
  const { userId, clinicId, invoiceId } = options;
  const lockKey = `prescription:dispense:${prescriptionId}`;

  log.info('Starting prescription dispense with distributed lock', {
    prescriptionId,
    itemCount: items?.length || 0,
    userId,
    invoiceId
  });

  // Use distributed lock to prevent concurrent dispense of same prescription
  // across multiple server instances
  const result = await withLock(lockKey, async () => {

    return await withTransactionRetry(async (session) => {
      const Prescription = mongoose.model('Prescription');
      const queryOptions = session ? { session } : {};

      // Load and lock prescription atomically
      const prescription = await Prescription.findOneAndUpdate(
        {
          _id: prescriptionId,
          status: { $nin: ['dispensed', 'cancelled'] },
          autoDispenseInProgress: { $ne: true }
        },
        {
          $set: {
            autoDispenseInProgress: true,
            autoDispenseStartedAt: new Date()
          }
        },
        { new: true, ...queryOptions }
      );

      if (!prescription) {
        // Check why we couldn't lock
        const existing = await Prescription.findById(prescriptionId).select('status autoDispenseInProgress').lean();

        if (!existing) {
          throw new Error('Ordonnance introuvable');
        }

        if (existing.status === 'dispensed') {
          throw new Error('Ordonnance deja dispensee');
        }

        if (existing.status === 'cancelled') {
          throw new Error('Ordonnance annulee');
        }

        if (existing.autoDispenseInProgress) {
          throw new Error('Ordonnance en cours de traitement par un autre processus');
        }

        throw new Error('Impossible de verrouiller l\'ordonnance pour dispense');
      }

      // Check expiry
      if (prescription.validUntil && new Date(prescription.validUntil) < new Date()) {
        // Release lock before throwing
        await Prescription.findByIdAndUpdate(prescriptionId, {
          $unset: { autoDispenseInProgress: '', autoDispenseStartedAt: '' }
        });
        throw new Error('Ordonnance expiree');
      }

      const dispensedItems = [];

      // Dispense each item using atomic inventory operations
      if (items && items.length > 0) {
        const { Inventory } = require('../models/Inventory');

        for (const item of items) {
          const { medicationId, quantity, lotNumber } = item;

          try {
            // Use atomic deduct from Inventory model
            const inventoryResult = await Inventory.atomicDeduct(
              medicationId,
              quantity,
              {
                reason: 'Dispensation ordonnance',
                reference: prescriptionId,
                referenceType: 'prescription',
                performedBy: userId,
                lotNumber: lotNumber,
                notes: `Ordonnance ${prescription.prescriptionId || prescriptionId}`
              },
              session
            );

            dispensedItems.push({
              medication: medicationId,
              quantity,
              lotNumber,
              dispensedAt: new Date(),
              inventoryStatus: inventoryResult.inventory.status
            });

            log.debug('Dispensed medication', {
              prescriptionId,
              medicationId,
              quantity,
              remainingStock: inventoryResult.inventory.currentStock
            });

          } catch (invError) {
            log.error('Failed to dispense medication', {
              prescriptionId,
              medicationId,
              quantity,
              error: invError.message
            });
            // Continue with other items but track the error
            dispensedItems.push({
              medication: medicationId,
              quantity,
              error: invError.message,
              dispensedAt: new Date()
            });
          }
        }
      }

      // Update prescription status
      prescription.status = 'dispensed';
      prescription.dispensedAt = new Date();
      prescription.dispensedBy = userId;
      prescription.dispensingHistory = prescription.dispensingHistory || [];
      prescription.dispensingHistory.push({
        date: new Date(),
        items: dispensedItems,
        dispensedBy: userId,
        invoiceId: invoiceId
      });

      // Clear the lock fields
      prescription.autoDispenseInProgress = undefined;
      prescription.autoDispenseStartedAt = undefined;
      prescription.autoDispenseInvoice = undefined;

      await prescription.save(queryOptions);

      log.info('Prescription dispensed successfully', {
        prescriptionId: prescription.prescriptionId || prescriptionId,
        itemsDispensed: dispensedItems.length,
        successCount: dispensedItems.filter(i => !i.error).length,
        errorCount: dispensedItems.filter(i => i.error).length
      });

      return {
        prescription,
        dispensedItems,
        success: true
      };
    });

  }, { ttl: 60 }); // 60 second lock timeout

  // If withLock returns null, another instance is processing
  if (result === null) {
    log.warn('Prescription dispense skipped - another instance is processing', {
      prescriptionId
    });
    throw new Error('Ordonnance en cours de traitement par un autre serveur. Veuillez reessayer.');
  }

  return result;
}

module.exports = {
  autoDispensePrescriptionsForInvoice,
  findPrescriptionsForInvoice,
  acquirePrescriptionLock,
  releasePrescriptionLock,
  findInventoryForMedication,
  deductInventory,
  dispenseSinglePrescription,
  dispensePrescription
};
