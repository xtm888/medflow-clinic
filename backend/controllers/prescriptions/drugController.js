/**
 * Drug Prescription Controller
 *
 * Handles medication/drug prescription operations:
 * - Dispensing and refills
 * - Pharmacy status workflow
 * - Drug safety checks and interactions
 * - Pharmacy communication
 */

const Prescription = require('../../models/Prescription');
const Patient = require('../../models/Patient');
const { Inventory, PharmacyInventory } = require('../../models/Inventory');
const Invoice = require('../../models/Invoice');
const AuditLog = require('../../models/AuditLog');
const mongoose = require('mongoose');
const { asyncHandler } = require('../../middleware/errorHandler');
const drugSafetyService = require('../../services/drugSafetyService');
const { success, error, notFound } = require('../../utils/apiResponse');
const { findPatientByIdOrCode } = require('../../utils/patientLookup');
const { prescription: prescriptionLogger } = require('../../utils/structuredLogger');
const websocketService = require('../../services/websocketService');

// Valid pharmacy status transitions
const PHARMACY_STATUS_TRANSITIONS = {
  'pending': ['received', 'cancelled'],
  'received': ['processing', 'on-hold', 'cancelled'],
  'processing': ['ready', 'on-hold', 'cancelled'],
  'on-hold': ['processing', 'cancelled'],
  'ready': ['dispensed', 'cancelled'],
  'dispensed': [], // Final state
  'cancelled': [] // Final state
};

// @desc    Dispense prescription
// @route   POST /api/prescriptions/:id/dispense
// @access  Private (Pharmacist, Admin)
exports.dispensePrescription = asyncHandler(async (req, res, next) => {
  // Try to use transactions if replica set is available, otherwise run without
  let session = null;
  let useTransaction = false;

  try {
    // Check if we're connected to a replica set before attempting transactions
    const client = mongoose.connection.getClient();
    const topology = client.topology;
    const isReplicaSet = topology && (topology.s?.description?.type === 'ReplicaSetWithPrimary' || topology.s?.description?.type === 'ReplicaSetNoPrimary');

    if (isReplicaSet) {
      session = await mongoose.startSession();
      session.startTransaction();
      useTransaction = true;
    } else {
      prescriptionLogger.info('Standalone MongoDB detected, proceeding without transaction support');
    }
  } catch (err) {
    // Transactions not supported (no replica set) - continue without transaction
    prescriptionLogger.info('Transactions not available', { error: err.message });
    if (session) {
      try { session.endSession(); } catch (e) { /* ignore */ }
    }
    session = null;
    useTransaction = false;
  }

  try {
    const prescription = await Prescription.findById(req.params.id);

    if (!prescription) {
      if (useTransaction) await session.abortTransaction();
      return notFound(res, 'Prescription');
    }

    // Check if prescription is expired
    if (prescription.isExpired) {
      if (useTransaction) await session.abortTransaction();
      return error(res, 'Cannot dispense an expired prescription');
    }

    // Check if already cancelled
    if (prescription.status === 'cancelled') {
      if (useTransaction) await session.abortTransaction();
      return error(res, 'Cannot dispense a cancelled prescription');
    }

    // Check if already fully dispensed
    if (prescription.status === 'dispensed') {
      if (useTransaction) await session.abortTransaction();
      return error(res, 'Prescription has already been fully dispensed');
    }

    // Process inventory deduction for medication prescriptions
    const inventoryUpdates = [];
    const insufficientStock = [];

    if (prescription.type === 'medication' && prescription.medications && prescription.medications.length > 0) {
      for (const medication of prescription.medications) {
        // Skip if already dispensed
        if (medication.dispensing?.dispensed) {
          continue;
        }

        // Find inventory item by medication name or inventoryItem reference
        let inventoryItem = null;

        if (medication.inventoryItem) {
          inventoryItem = await PharmacyInventory.findById(medication.inventoryItem);
        }

        // If no direct reference, try to find by medication name
        if (!inventoryItem && medication.name) {
          // Escape special regex characters to prevent ReDoS/injection attacks
          const escapedMedName = medication.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          inventoryItem = await PharmacyInventory.findOne({
            $or: [
              { 'medication.genericName': { $regex: new RegExp(escapedMedName, 'i') } },
              { 'medication.brandName': { $regex: new RegExp(escapedMedName, 'i') } }
            ],
            'inventory.currentStock': { $gt: 0 }
          });
        }

        if (inventoryItem) {
          const quantityToDispense = medication.quantity || 1;

          // Check if sufficient stock is available
          if (inventoryItem.inventory.currentStock < quantityToDispense) {
            insufficientStock.push({
              medication: medication.name,
              required: quantityToDispense,
              available: inventoryItem.inventory.currentStock
            });
          } else {
            inventoryUpdates.push({
              inventoryItem,
              medication,
              quantity: quantityToDispense
            });
          }
        }
        // If no inventory item found, we'll still dispense but without inventory deduction
      }

      // If any medication has insufficient stock, abort the transaction
      if (insufficientStock.length > 0) {
        if (useTransaction) await session.abortTransaction();
        return res.status(400).json({
          success: false,
          error: 'Insufficient stock for some medications',
          insufficientStock
        });
      }

      // Deduct inventory for each medication
      for (const update of inventoryUpdates) {
        const { inventoryItem, medication, quantity } = update;

        // Update inventory stock
        inventoryItem.inventory.currentStock -= quantity;

        // Update stock status
        if (inventoryItem.inventory.currentStock <= 0) {
          inventoryItem.inventory.status = 'out-of-stock';
        } else if (inventoryItem.inventory.currentStock <= (inventoryItem.inventory.reorderPoint || 10)) {
          inventoryItem.inventory.status = 'low-stock';
        }

        // Add to dispensing history
        if (!inventoryItem.usage) {
          inventoryItem.usage = { dispensingHistory: [] };
        }
        if (!inventoryItem.usage.dispensingHistory) {
          inventoryItem.usage.dispensingHistory = [];
        }

        inventoryItem.usage.dispensingHistory.push({
          date: new Date(),
          quantity,
          prescriptionId: prescription._id,
          patientId: prescription.patient,
          dispensedBy: req.user._id || req.user.id,
          lotNumber: req.body.lotNumber
        });

        // Add transaction record
        if (!inventoryItem.transactions) {
          inventoryItem.transactions = [];
        }

        inventoryItem.transactions.push({
          type: 'dispensed',
          quantity,
          date: new Date(),
          performedBy: req.user._id || req.user.id,
          reference: `Prescription ${prescription._id}`,
          notes: 'Dispensed for patient prescription'
        });

        // Pass session to save for transaction safety
        await inventoryItem.save(useTransaction ? { session } : undefined);

        // Mark medication as dispensed in prescription
        medication.dispensing = {
          dispensed: true,
          dispensedQuantity: quantity,
          dispensedBy: req.user._id || req.user.id,
          dispensedAt: new Date()
        };
      }
    }

    // Add dispensing record to prescription
    const dispensingRecord = {
      dispensedBy: req.user._id || req.user.id,
      dispensedAt: Date.now(),
      pharmacy: req.body.pharmacy,
      quantity: req.body.quantity,
      daysSupply: req.body.daysSupply,
      lotNumber: req.body.lotNumber,
      expirationDate: req.body.expirationDate,
      copayAmount: req.body.copayAmount,
      totalCost: req.body.totalCost,
      notes: req.body.notes,
      inventoryDeducted: inventoryUpdates.length > 0
    };

    prescription.dispensing.push(dispensingRecord);

    // Update status based on refills
    if (prescription.type === 'medication') {
      // Get unique fill dates (same-day dispenses count as 1 fill)
      const uniqueFillDates = new Set(
        prescription.dispensing.map(d => {
          const date = new Date(d.dispensedAt);
          return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        })
      );
      const totalFills = uniqueFillDates.size;
      const totalAllowed = prescription.medications[0]?.refills?.allowed || 0;
      const maxFills = totalAllowed + 1; // Initial fill + allowed refills

      if (totalFills >= maxFills) {
        prescription.status = 'dispensed';
      } else {
        prescription.status = 'partial';
        // Update remaining refills for each medication
        const remainingRefills = maxFills - totalFills;
        prescription.medications.forEach(med => {
          if (med.refills) {
            med.refills.remaining = Math.max(0, remainingRefills - 1);
          }
        });
      }
    } else {
      prescription.status = 'dispensed';
    }

    // Re-fetch prescription to check if it was already dispensed
    const currentPrescription = await Prescription.findById(prescription._id).select('status __v');
    if (currentPrescription && currentPrescription.status === 'dispensed') {
      if (useTransaction) {
        await session.abortTransaction();
      }
      return success(res, { data: await Prescription.findById(prescription._id), message: 'Prescription already dispensed (auto-dispensed on payment)' });
    }

    // Use findByIdAndUpdate to avoid version conflicts
    const updatedPrescription = await Prescription.findByIdAndUpdate(
      prescription._id,
      {
        $set: {
          status: prescription.status,
          medications: prescription.medications,
          dispensing: prescription.dispensing,
          dispensedAt: prescription.status === 'dispensed' ? new Date() : undefined
        }
      },
      { new: true, session: useTransaction ? session : undefined }
    );

    // Commit the transaction if using one
    if (useTransaction) {
      await session.commitTransaction();
    }

    // Generate invoice for dispensed medications (only if not already invoiced)
    let invoice = null;
    if (prescription.type === 'medication' && inventoryUpdates.length > 0) {
      try {
        if (prescription.invoice) {
          const existingInvoice = await Invoice.findById(prescription.invoice);
          if (existingInvoice) {
            prescriptionLogger.info('Operation', { data: `[Prescription ${prescription.prescriptionId}] Invoice already exists (${existingInvoice.invoiceId}), skipping creation` });
            invoice = existingInvoice;
          }
        }

        // Only create new invoice if none exists
        if (!invoice) {
          const invoiceItems = inventoryUpdates.map(u => ({
            description: u.medication.name,
            category: 'medication',
            code: u.medication.code || '',
            quantity: u.quantity,
            unitPrice: u.inventoryItem.pricing?.sellingPrice || 0,
            discount: 0,
            subtotal: (u.inventoryItem.pricing?.sellingPrice || 0) * u.quantity,
            tax: 0,
            total: (u.inventoryItem.pricing?.sellingPrice || 0) * u.quantity,
            reference: `Prescription:${prescription.prescriptionId}`
          }));

          const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);

          if (subtotal > 0) {
            invoice = await Invoice.create({
              patient: prescription.patient,
              prescription: prescription._id,
              dateIssued: new Date(),
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              items: invoiceItems,
              summary: {
                subtotal,
                discountTotal: 0,
                taxTotal: 0,
                total: subtotal,
                amountPaid: 0,
                amountDue: subtotal
              },
              status: 'issued',
              billing: {
                currency: process.env.BASE_CURRENCY || 'CDF'
              },
              notes: {
                internal: `Prescription ${prescription.prescriptionId} dispensed`,
                billing: `${inventoryUpdates.length} medication(s) dispensed`
              },
              createdBy: req.user._id || req.user.id
            });

            // Link invoice to prescription
            prescription.invoice = invoice._id;
            await prescription.save();
          }
        }
      } catch (invoiceError) {
        prescriptionLogger.error('Error generating invoice for prescription:', { error: invoiceError.message });
      }
    }

    // Audit log for prescription dispense
    try {
      await AuditLog.create({
        user: req.user._id || req.user.id,
        action: 'PRESCRIPTION_DISPENSE',
        resource: `/api/prescriptions/${prescription._id}/dispense`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          prescriptionId: prescription.prescriptionId,
          patientId: prescription.patient,
          medicationsDispensed: inventoryUpdates.length,
          invoiceId: invoice?.invoiceId || null,
          totalAmount: invoice?.summary?.total || 0
        }
      });
    } catch (auditError) {
      prescriptionLogger.error('Error creating audit log:', { error: auditError.message });
    }

    // WebSocket broadcast
    try {
      const dispensedMeds = inventoryUpdates.map(u => u.medication.name).join(', ');
      const patientId = prescription.patient?.toString() || prescription.patient;
      const prescriberId = prescription.prescriber?.toString() || prescription.prescriber;

      // Notify patient
      if (patientId) {
        websocketService.sendNotificationToUser(patientId, {
          type: 'prescription_dispensed',
          prescriptionId: prescription._id,
          prescriptionNumber: prescription.prescriptionId,
          status: updatedPrescription?.status || prescription.status,
          medications: dispensedMeds,
          message: 'Votre ordonnance a été délivrée',
          invoiceId: invoice?.invoiceId,
          timestamp: new Date()
        });
      }

      // Notify prescribing doctor
      if (prescriberId && prescriberId !== patientId) {
        websocketService.sendNotificationToUser(prescriberId, {
          type: 'prescription_dispensed',
          prescriptionId: prescription._id,
          prescriptionNumber: prescription.prescriptionId,
          status: updatedPrescription?.status || prescription.status,
          message: `Ordonnance délivrée: ${dispensedMeds}`,
          timestamp: new Date()
        });
      }

      prescriptionLogger.info('Operation', { data: '[PRESCRIPTION DISPENSE] WebSocket notifications sent' });
    } catch (wsError) {
      prescriptionLogger.warn('WebSocket broadcast failed', { error: wsError.message });
    }

    res.status(200).json({
      success: true,
      message: 'Prescription dispensed successfully',
      data: updatedPrescription || prescription,
      invoice: invoice ? { invoiceId: invoice.invoiceId, total: invoice.summary.total } : null,
      inventoryUpdated: inventoryUpdates.length,
      inventoryDeductions: inventoryUpdates.map(u => ({
        medication: u.medication.name,
        quantity: u.quantity,
        remainingStock: u.inventoryItem.inventory.currentStock
      }))
    });

  } catch (error) {
    if (useTransaction) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
});

// @desc    Refill prescription
// @route   POST /api/prescriptions/:id/refill
// @access  Private (Pharmacist, Admin)
exports.refillPrescription = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  // Check if prescription is valid
  if (prescription.isExpired) {
    return error(res, 'Cannot refill an expired prescription');
  }

  if (prescription.status === 'cancelled') {
    return error(res, 'Cannot refill a cancelled prescription');
  }

  // Check refills available
  const medication = prescription.medications[0];
  if (!medication?.refills || medication.refills.remaining <= 0) {
    return error(res, 'No refills remaining for this prescription');
  }

  // Process refill helper
  const processRefill = async (useSession = false, session = null) => {
    // Deduct refill count
    prescription.medications.forEach(med => {
      if (med.refills && med.refills.remaining > 0) {
        med.refills.remaining -= 1;
        med.refills.lastRefillDate = new Date();
      }
    });

    // Add dispensing record
    const refillRecord = {
      dispensedBy: req.user._id || req.user.id,
      dispensedAt: Date.now(),
      quantity: req.body.quantity,
      daysSupply: req.body.daysSupply,
      lotNumber: req.body.lotNumber,
      notes: req.body.notes || 'Refill',
      isRefill: true,
      refillNumber: prescription.dispensing.filter(d => d.isRefill).length + 1
    };

    prescription.dispensing.push(refillRecord);

    // Update status
    const allRefillsUsed = prescription.medications.every(
      med => !med.refills || med.refills.remaining === 0
    );

    if (allRefillsUsed) {
      prescription.status = 'dispensed';
    } else {
      prescription.status = 'partial';
    }

    await prescription.save(useSession ? { session } : {});
  };

  // Try with transaction first, fall back to non-transactional if not supported
  try {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await processRefill(true, session);
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    // If transaction not supported (standalone MongoDB), retry without transaction
    if (error.code === 20 || error.codeName === 'IllegalOperation') {
      prescriptionLogger.info('Transactions not supported, saving without transaction');
      await processRefill(false);
    } else {
      throw error;
    }
  }

  res.json({
    success: true,
    message: 'Prescription refilled successfully',
    data: {
      prescription,
      refillsRemaining: prescription.medications[0]?.refills?.remaining || 0
    }
  });
});

// @desc    Get refill history
// @route   GET /api/prescriptions/:id/refill-history
// @access  Private
exports.getRefillHistory = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('dispensing.dispensedBy', 'firstName lastName');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  const refillHistory = prescription.dispensing.map((d, index) => ({
    refillNumber: index,
    isInitialFill: index === 0 && !d.isRefill,
    isRefill: d.isRefill || false,
    dispensedAt: d.dispensedAt,
    dispensedBy: d.dispensedBy,
    quantity: d.quantity,
    daysSupply: d.daysSupply,
    notes: d.notes
  }));

  res.json({
    success: true,
    data: {
      prescriptionId: prescription.prescriptionId,
      totalAllowed: (prescription.medications[0]?.refills?.allowed || 0) + 1,
      totalDispensed: prescription.dispensing.length,
      remaining: prescription.medications[0]?.refills?.remaining || 0,
      history: refillHistory
    }
  });
});

// @desc    Update pharmacy status
// @route   PUT /api/prescriptions/:id/pharmacy-status
// @access  Private (Pharmacist, Admin)
exports.updatePharmacyStatus = asyncHandler(async (req, res) => {
  const { status, notes, reason } = req.body;

  if (!status) {
    return error(res, 'Status is required');
  }

  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  const currentStatus = prescription.pharmacyStatus || 'pending';
  const allowedTransitions = PHARMACY_STATUS_TRANSITIONS[currentStatus] || [];

  if (!allowedTransitions.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Cannot transition from '${currentStatus}' to '${status}'. Allowed transitions: ${allowedTransitions.join(', ')}`
    });
  }

  // Update status
  prescription.pharmacyStatus = status;

  // Add to status history
  if (!prescription.pharmacyStatusHistory) {
    prescription.pharmacyStatusHistory = [];
  }

  prescription.pharmacyStatusHistory.push({
    status,
    changedAt: new Date(),
    changedBy: req.user._id || req.user.id,
    notes,
    reason
  });

  // Update main status if needed
  if (status === 'dispensed') {
    prescription.status = 'dispensed';
  } else if (status === 'cancelled') {
    prescription.status = 'cancelled';
  }

  await prescription.save();

  res.json({
    success: true,
    message: `Pharmacy status updated to '${status}'`,
    data: {
      pharmacyStatus: prescription.pharmacyStatus,
      statusHistory: prescription.pharmacyStatusHistory
    }
  });
});

// @desc    Send prescription to pharmacy
// @route   POST /api/prescriptions/:id/send-to-pharmacy
// @access  Private (Doctor, Admin)
exports.sendToPharmacy = asyncHandler(async (req, res) => {
  const { pharmacyId, pharmacyName, notes, urgent } = req.body;

  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  if (prescription.status === 'cancelled') {
    return error(res, 'Cannot send a cancelled prescription');
  }

  // Require prescription to be signed before sending to pharmacy
  if (!prescription.signature?.prescriber?.signed) {
    return error(res, 'Prescription must be signed by the prescriber before sending to pharmacy');
  }

  // Update prescription with pharmacy info
  prescription.pharmacy = {
    pharmacyId: pharmacyId || 'internal',
    pharmacyName: pharmacyName || 'Internal Pharmacy',
    sentAt: new Date(),
    sentBy: req.user._id || req.user.id,
    urgent: urgent || false,
    notes
  };

  prescription.pharmacyStatus = 'received';
  prescription.status = 'ready';

  // Add to status history
  if (!prescription.pharmacyStatusHistory) {
    prescription.pharmacyStatusHistory = [];
  }

  prescription.pharmacyStatusHistory.push({
    status: 'received',
    changedAt: new Date(),
    changedBy: req.user._id || req.user.id,
    notes: `Sent to pharmacy: ${pharmacyName || 'Internal Pharmacy'}`
  });

  await prescription.save();

  res.json({
    success: true,
    message: 'Prescription sent to pharmacy',
    data: {
      prescriptionId: prescription.prescriptionId,
      pharmacyStatus: prescription.pharmacyStatus,
      pharmacy: prescription.pharmacy
    }
  });
});

// @desc    Check drug interactions
// @route   POST /api/prescriptions/check-interactions
// @access  Private
exports.checkDrugInteractions = asyncHandler(async (req, res) => {
  const { drugs, patientId, currentMedications } = req.body;

  if (!drugs || !Array.isArray(drugs) || drugs.length === 0) {
    return error(res, 'At least one drug is required');
  }

  let patientMedications = currentMedications || [];

  // If patientId provided, get patient's current medications
  if (patientId) {
    const patient = await findPatientByIdOrCode(patientId);
    if (patient && patient.medications) {
      patientMedications = patient.medications.filter(m => m.status === 'active');
    }
  }

  // Check interactions between new drugs and current medications (local)
  const allInteractions = [];
  drugs.forEach(drug => {
    const result = drugSafetyService.checkDrugInteractions(drug, patientMedications);
    if (result.hasInteraction) {
      allInteractions.push({
        drug: drug.genericName || drug.name,
        source: 'local',
        ...result
      });
    }
  });

  // Check interactions between the new drugs themselves (local)
  const interDrugInteractions = [];
  for (let i = 0; i < drugs.length; i++) {
    for (let j = i + 1; j < drugs.length; j++) {
      const result = drugSafetyService.checkDrugInteractions(drugs[i], [drugs[j]]);
      if (result.hasInteraction) {
        interDrugInteractions.push(...result.interactions.map(int => ({ ...int, source: 'local' })));
      }
    }
  }

  // Also check external APIs (BDPM, RxNorm, OpenFDA)
  const externalInteractions = [];
  const externalSources = new Set();

  try {
    for (const drug of drugs) {
      const drugName = drug.genericName || drug.name;
      const externalResult = await drugSafetyService.checkInteractionsWithExternalAPI(drugName, patientMedications);

      if (externalResult.hasInteraction) {
        externalInteractions.push(...externalResult.interactions);
        externalResult.sources.forEach(s => externalSources.add(s));
      }
    }

    // Also check interactions between new drugs via external APIs
    for (let i = 0; i < drugs.length; i++) {
      for (let j = i + 1; j < drugs.length; j++) {
        const drugName = drugs[i].genericName || drugs[i].name;
        const otherDrug = drugs[j].genericName || drugs[j].name;
        const externalResult = await drugSafetyService.checkInteractionsWithExternalAPI(drugName, [{ name: otherDrug }]);

        if (externalResult.hasInteraction) {
          externalInteractions.push(...externalResult.interactions);
          externalResult.sources.forEach(s => externalSources.add(s));
        }
      }
    }
  } catch (externalError) {
    prescriptionLogger.warn('External API drug interaction check failed', { error: externalError.message });
  }

  // Combine all interactions
  const allCombined = [...allInteractions];
  const interDrugCombined = [...interDrugInteractions, ...externalInteractions];

  const hasContraindicated = allCombined.some(i => i.contraindicated?.length > 0) ||
                            interDrugCombined.some(i => i.severity === 'contraindicated');
  const hasMajor = allCombined.some(i => i.major?.length > 0) ||
                   interDrugCombined.some(i => i.severity === 'major');

  res.json({
    success: true,
    data: {
      drugInteractions: allCombined,
      interDrugInteractions: interDrugCombined,
      externalSources: Array.from(externalSources),
      hasInteractions: allCombined.length > 0 || interDrugCombined.length > 0,
      hasContraindicated,
      hasMajor,
      safeToDispense: !hasContraindicated
    }
  });
});

// @desc    Run comprehensive safety check
// @route   POST /api/prescriptions/safety-check
// @access  Private
exports.runSafetyCheck = asyncHandler(async (req, res) => {
  const { drugs, patientId } = req.body;

  if (!drugs || !patientId) {
    return error(res, 'Drugs and patient ID are required');
  }

  const patient = await findPatientByIdOrCode(patientId);
  if (!patient) {
    return notFound(res, 'Patient');
  }

  const currentMedications = patient.medications?.filter(m => m.status === 'active') || [];

  // Run local comprehensive check for all drugs
  const results = drugSafetyService.checkMultipleDrugs(drugs, patient, currentMedications);

  // Also check external APIs (BDPM, RxNorm, OpenFDA) for comprehensive interactions
  const externalResults = {
    interactions: [],
    sources: new Set()
  };

  try {
    for (const drug of drugs) {
      const drugName = drug.genericName || drug.name;
      const externalCheck = await drugSafetyService.checkInteractionsWithExternalAPI(drugName, currentMedications);

      if (externalCheck.hasInteraction) {
        externalResults.interactions.push(...externalCheck.interactions);
        externalCheck.sources.forEach(s => externalResults.sources.add(s));

        // Update overall results with external findings
        const hasExternalCritical = externalCheck.interactions.some(
          int => int.severity === 'contraindicated'
        );
        const hasExternalMajor = externalCheck.interactions.some(
          int => int.severity === 'major'
        );

        if (hasExternalCritical) results.hasAnyCritical = true;
        if (hasExternalMajor) results.hasAnyMajor = true;
      }
    }
  } catch (externalError) {
    prescriptionLogger.warn('External API safety check failed', { error: externalError.message });
  }

  // Merge external interactions into results
  results.externalInteractions = externalResults.interactions;
  results.externalSources = Array.from(externalResults.sources);
  results.overallSafe = !results.hasAnyCritical && !results.hasAnyMajor;

  res.json({
    success: true,
    data: results
  });
});

// @desc    Get drug safety service status
// @route   GET /api/prescriptions/drug-safety/status
// @access  Private
exports.getDrugSafetyStatus = asyncHandler(async (req, res) => {
  // Get local database statistics
  const databaseStats = drugSafetyService.getDatabaseStatistics();

  // Get external API status
  const externalAPIs = drugSafetyService.getExternalAPIStatus();

  res.json({
    success: true,
    data: {
      localDatabase: databaseStats,
      externalAPIs,
      capabilities: {
        drugInteractionChecks: true,
        allergyChecks: true,
        duplicateTherapyChecks: true,
        dosageVerification: true,
        renalDosing: true,
        ageWarnings: true,
        pregnancyWarnings: true
      },
      recommendedConfiguration: {
        forFrenchMedications: 'BDPM API (Base de Données Publique des Médicaments)',
        forUSMedications: 'RxNorm + OpenFDA',
        forInteractions: 'All sources combined for comprehensive coverage'
      }
    }
  });
});

// @desc    Get drug prescriptions
// @route   GET /api/prescriptions/drug
// @access  Private
exports.getDrugPrescriptions = asyncHandler(async (req, res) => {
  const { patient, status, page = 1, limit = 20 } = req.query;

  const query = { type: 'medication' };

  if (patient) query.patient = patient;
  if (status) query.status = status;

  const prescriptions = await Prescription.find(query)
    .populate('patient', 'firstName lastName patientId dateOfBirth')
    .populate('prescriber', 'firstName lastName specialization')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Prescription.countDocuments(query);

  res.json({
    success: true,
    count: prescriptions.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: prescriptions
  });
});

// @desc    Create drug prescription
// @route   POST /api/prescriptions/drug
// @access  Private (Doctor, Ophthalmologist, Admin)
exports.createDrugPrescription = asyncHandler(async (req, res) => {
  const {
    patient,
    medications,
    diagnosis,
    notes,
    validUntil
  } = req.body;

  // Validate patient exists
  const patientExists = await findPatientByIdOrCode(patient);
  if (!patientExists) {
    return notFound(res, 'Patient');
  }

  if (!medications || medications.length === 0) {
    return error(res, 'At least one medication is required');
  }

  // Generate prescription ID
  const count = await Prescription.countDocuments();
  const prescriptionId = `RX-${Date.now()}-${(count + 1).toString().padStart(5, '0')}`;
  const { PRESCRIPTION } = require('../../config/constants');

  const prescription = await Prescription.create({
    prescriptionId,
    type: 'medication',
    patient,
    prescriber: req.user._id || req.user.id,
    medications: medications.map(med => ({
      name: med.name,
      dosage: med.dosage,
      frequency: med.frequency,
      duration: med.duration,
      quantity: med.quantity,
      refills: med.refills || 0,
      instructions: med.instructions,
      route: med.route || 'oral'
    })),
    diagnosis,
    notes,
    dateIssued: new Date(),
    validUntil: validUntil || new Date(Date.now() + PRESCRIPTION.MEDICATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000),
    status: 'active',
    signature: {
      prescriber: {
        signed: false
      }
    }
  });

  await prescription.populate('patient', 'firstName lastName patientId');
  await prescription.populate('prescriber', 'firstName lastName specialization');

  res.status(201).json({
    success: true,
    data: prescription
  });
});
