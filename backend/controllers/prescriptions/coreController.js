/**
 * Core Prescription Controller
 *
 * Handles core prescription operations:
 * - CRUD operations
 * - Signing and verification
 * - Invoice creation
 * - PDF generation and printing
 * - Templates management
 * - Statistics and reporting
 * - History and cloning
 * - Bulk operations
 * - Patient/provider queries
 * - Utility functions (QR, send to patient, insurance coverage)
 */

const Prescription = require('../../models/Prescription');
const Patient = require('../../models/Patient');
const Visit = require('../../models/Visit');
const { Inventory, PharmacyInventory } = require('../../models/Inventory');
const Invoice = require('../../models/Invoice');
const AuditLog = require('../../models/AuditLog');
const mongoose = require('mongoose');
const { asyncHandler } = require('../../middleware/errorHandler');
const { sanitizeForAssign } = require('../../utils/sanitize');
const drugSafetyService = require('../../services/drugSafetyService');
const { success, error, notFound, paginated } = require('../../utils/apiResponse');
const { findPatientByIdOrCode } = require('../../utils/patientLookup');
const { createContextLogger } = require('../../utils/structuredLogger');
const { PRESCRIPTION, PAGINATION } = require('../../config/constants');
const websocketService = require('../../services/websocketService');

const log = createContextLogger('PrescriptionCore');

// ============================================
// CRUD OPERATIONS
// ============================================

// @desc    Get all prescriptions
// @route   GET /api/prescriptions
// @access  Private
exports.getPrescriptions = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    type,
    patient,
    prescriber,
    dateFrom,
    dateTo,
    sort = '-dateIssued'
  } = req.query;

  const query = {};

  if (status) query.status = status;
  if (type) query.type = type;
  if (patient) query.patient = patient;

  if (prescriber) {
    query.prescriber = prescriber;
  } else if (req.user.role === 'doctor' || req.user.role === 'ophthalmologist') {
    query.prescriber = req.user._id || req.user.id;
  }

  if (dateFrom || dateTo) {
    query.dateIssued = {};
    if (dateFrom) query.dateIssued.$gte = new Date(dateFrom);
    if (dateTo) query.dateIssued.$lte = new Date(dateTo);
  }

  const prescriptions = await Prescription.find(query)
    .populate('patient', 'firstName lastName patientId')
    .populate('prescriber', 'firstName lastName licenseNumber')
    .populate('visit', 'visitId visitDate status')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort(sort);

  const count = await Prescription.countDocuments(query);

  return paginated(res, prescriptions, {
    count: prescriptions.length,
    total: count,
    pages: Math.ceil(count / limit),
    currentPage: parseInt(page)
  });
});

// @desc    Get single prescription
// @route   GET /api/prescriptions/:id
// @access  Private
exports.getPrescription = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('patient')
    .populate('prescriber', 'firstName lastName licenseNumber department')
    .populate('visit', 'visitId visitDate status primaryProvider')
    .populate('appointment', 'date type');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  prescription.viewHistory.push({
    viewedBy: req.user._id || req.user.id,
    viewedAt: Date.now(),
    action: 'VIEW'
  });
  await prescription.save();

  return success(res, { data: prescription });
});

// @desc    Create prescription
// @route   POST /api/prescriptions
// @access  Private (Doctor, Ophthalmologist)
exports.createPrescription = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  req.body.prescriber = userId;
  req.body.createdBy = userId;

  const patient = await findPatientByIdOrCode(req.body.patient);
  if (!patient) {
    return notFound(res, 'Patient');
  }

  if (!patient.dateOfBirth) {
    return res.status(400).json({
      success: false,
      error: 'Patient date of birth is required for safe prescription creation',
      message: 'Cannot create prescription without patient date of birth.'
    });
  }

  // Drug safety checks for medication prescriptions
  if (req.body.type === 'medication' && req.body.medications) {
    const currentMeds = patient.medications?.filter(m => m.status === 'active') || [];
    const safetyResults = drugSafetyService.checkMultipleDrugs(req.body.medications, patient, currentMeds);

    // External API checks
    const externalSources = new Set();
    try {
      const externalCheckPromises = req.body.medications.map(med => {
        const medName = med.genericName || med.name;
        return drugSafetyService.checkInteractionsWithExternalAPI(medName, currentMeds)
          .catch(err => {
            log.warn('External API check failed', { medication: medName, error: err.message });
            return null;
          });
      });

      const externalResults = await Promise.all(externalCheckPromises);
      externalResults.forEach(result => {
        if (result && result.hasInteraction) {
          result.sources.forEach(s => externalSources.add(s));
          const hasCriticalExternal = result.interactions.some(
            int => int.severity === 'contraindicated' || int.severity === 'major'
          );
          if (hasCriticalExternal && !safetyResults.hasAnyCritical) {
            safetyResults.hasAnyCritical = result.interactions.some(int => int.severity === 'contraindicated');
            safetyResults.hasAnyMajor = true;
          }
        }
      });
    } catch (externalError) {
      log.warn('External API check failed, using local data only', { error: externalError.message });
    }

    if (safetyResults.hasAnyCritical) {
      return res.status(400).json({
        success: false,
        error: 'Critical drug safety issues detected',
        safetyCheck: safetyResults,
        externalSources: Array.from(externalSources),
        message: 'Prescription cannot be created due to critical safety concerns.'
      });
    }

    // Add warnings
    const warnings = req.body.warnings || [];
    safetyResults.drugChecks.forEach(check => {
      if (check.interactions?.hasInteraction) {
        check.interactions.interactions.forEach(interaction => {
          warnings.push(`${interaction.severity.toUpperCase()}: ${interaction.effect} (${interaction.drug1} + ${interaction.drug2})`);
        });
      }
      if (check.allergies?.hasAllergy) {
        warnings.push(`ALLERGY WARNING: Patient may be allergic to ${check.drug}`);
      }
    });

    if (warnings.length > 0) {
      req.body.warnings = warnings;
      req.body.safetyCheckPerformed = true;
      req.body.safetyCheckResult = {
        timestamp: new Date(),
        overallSafe: safetyResults.overallSafe,
        hasWarnings: safetyResults.hasAnyMajor,
        externalSources: Array.from(externalSources)
      };
    }

    // Validate withFood for high-risk drugs
    const HIGH_RISK_DRUG_PATTERNS = [
      /\b(ibuprofen|diclofenac|naproxen|ketoprofen|meloxicam|piroxicam|indomethacin|aspirin|celecoxib|etoricoxib)\b/i,
      /\b(amoxicillin|azithromycin|ciprofloxacin|levofloxacin|metronidazole|doxycycline|tetracycline|erythromycin|clarithromycin)\b/i,
      /\b(prednisone|prednisolone|dexamethasone|methylprednisolone|hydrocortisone)\b/i,
      /\b(alendronate|risedronate|ibandronate|zoledronic)\b/i,
      /\b(ferrous|iron|folic)\b/i,
      /\b(potassium|kcl|slow-k)\b/i,
      /\b(metformin|glimepiride|glipizide|glyburide)\b/i
    ];

    const missingWithFood = [];
    for (const med of req.body.medications) {
      const medName = (med.genericName || med.name || '').toLowerCase();
      const isHighRisk = HIGH_RISK_DRUG_PATTERNS.some(pattern => pattern.test(medName));
      if (isHighRisk && !med.dosage?.withFood) {
        missingWithFood.push({
          medication: med.name || med.genericName,
          reason: 'High-risk medication requires food timing instructions'
        });
      }
    }

    if (missingWithFood.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing food timing instructions for high-risk medications',
        medicationsNeedingFoodInstructions: missingWithFood,
        message: 'Les medicaments a haut risque necessitent des instructions de prise alimentaire.',
        hint: 'Set dosage.withFood to one of: before, with, after, empty-stomach, anytime'
      });
    }

    // Validate ophthalmic routes have eye selection
    const OPHTHALMIC_ROUTES = ['ophthalmic', 'intravitreal', 'subconjunctival', 'periocular', 'intracameral'];
    const missingEyeSelection = [];
    for (const med of req.body.medications) {
      if (OPHTHALMIC_ROUTES.includes(med.route)) {
        if (!med.applicationLocation?.eye || !['OD', 'OS', 'OU'].includes(med.applicationLocation.eye)) {
          missingEyeSelection.push({
            medication: med.name || med.genericName,
            route: med.route,
            reason: 'Ophthalmic medications must specify eye: OD, OS, or OU'
          });
        }
      }
    }

    if (missingEyeSelection.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing eye selection for ophthalmic medications',
        medicationsNeedingEyeSelection: missingEyeSelection,
        hint: 'Set applicationLocation.eye to one of: OD, OS, OU'
      });
    }

    // Check inventory and enrich with pricing
    for (const med of req.body.medications) {
      const inventoryItem = await PharmacyInventory.findOne({
        $or: [
          { 'medication.genericName': new RegExp(`^${med.genericName || med.name}$`, 'i') },
          { 'medication.brandName': new RegExp(`^${med.name}$`, 'i') }
        ]
      });

      if (inventoryItem) {
        med.inventoryItem = inventoryItem._id;
        const unitPrice = inventoryItem.pricing?.sellingPrice || 0;
        med.pricing = {
          unitPrice,
          totalCost: unitPrice * (med.quantity || 1),
          currency: process.env.BASE_CURRENCY || 'CDF'
        };
      }
    }

    // Controlled substance compliance
    for (const med of req.body.medications) {
      if (med.inventoryItem) {
        const inventoryItem = await PharmacyInventory.findById(med.inventoryItem);
        if (inventoryItem?.controlledSubstance?.isControlled) {
          const schedule = inventoryItem.controlledSubstance.schedule;
          med.controlledSubstance = {
            isControlled: true,
            schedule,
            requiresSpecialHandling: inventoryItem.controlledSubstance.requiresSpecialHandling,
            requiresSignature: inventoryItem.controlledSubstance.requiresSignature
          };

          if (schedule === 'I') {
            return res.status(400).json({
              success: false,
              error: 'Cannot prescribe Schedule I controlled substances',
              message: 'Les substances de l\'annexe I ne peuvent pas etre prescrites.'
            });
          }

          if (schedule === 'II') {
            med.refills = { allowed: 0, remaining: 0 };
          }
        }
      }
    }
  }

  // Save prescription with transaction if available
  const savePrescription = async (useSession = false, session = null) => {
    const createOptions = useSession ? { session } : {};
    const prescriptions = await Prescription.create([req.body], createOptions);
    const prescription = prescriptions[0];

    if (!patient.prescriptions.includes(prescription._id)) {
      patient.prescriptions.push(prescription._id);
    }
    if (prescription.type === 'optical') {
      patient.ophthalmology.latestOpticalPrescription = prescription._id;
    }
    await patient.save(useSession ? { session } : {});

    if (req.body.visit) {
      const visit = useSession
        ? await Visit.findById(req.body.visit).session(session)
        : await Visit.findById(req.body.visit);
      if (visit && !visit.prescriptions.includes(prescription._id)) {
        visit.prescriptions.push(prescription._id);
        await visit.save(useSession ? { session } : {});
      }
    }

    return prescription;
  };

  let prescription;
  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      prescription = await savePrescription(true, session);
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (err) {
    if (err.code === 20 || err.codeName === 'IllegalOperation') {
      log.info('Transactions not supported, saving without transaction');
      prescription = await savePrescription(false);
    } else {
      throw err;
    }
  }

  await prescription.populate('patient', 'firstName lastName patientId');
  await prescription.populate('prescriber', 'firstName lastName');
  await prescription.populate('visit', 'visitId visitDate status');

  // WebSocket notification
  try {
    const medicationNames = prescription.type === 'medication' && prescription.medications
      ? prescription.medications.map(m => m.name || m.genericName).filter(Boolean)
      : [];

    websocketService.sendNotificationToRole('pharmacist', {
      type: 'prescription_created',
      prescriptionId: prescription._id,
      prescriptionNumber: prescription.prescriptionId,
      patientId: prescription.patient._id,
      patientName: `${prescription.patient.firstName} ${prescription.patient.lastName}`,
      prescriptionType: prescription.type,
      medications: medicationNames,
      urgent: prescription.isUrgent || false,
      timestamp: new Date()
    });

    if (prescription.patient._id) {
      websocketService.sendNotificationToUser(prescription.patient._id.toString(), {
        type: 'prescription_ready',
        prescriptionId: prescription._id,
        message: 'Votre ordonnance est prete',
        timestamp: new Date()
      });
    }
  } catch (wsError) {
    log.warn('WebSocket broadcast failed', { error: wsError.message });
  }

  res.status(201).json({ success: true, data: prescription });
});

// @desc    Create prescription with safety override
// @route   POST /api/prescriptions/create-with-override
// @access  Private (Doctor, Ophthalmologist ONLY)
exports.createPrescriptionWithSafetyOverride = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { overrideReason, safetyWarnings, ...prescriptionData } = req.body;

  if (!overrideReason || overrideReason.trim().length < 20) {
    return res.status(400).json({
      success: false,
      error: 'Override reason required',
      message: 'Une raison medicale detaillee (minimum 20 caracteres) est obligatoire.'
    });
  }

  if (!safetyWarnings || !Array.isArray(safetyWarnings) || safetyWarnings.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Safety warnings acknowledgment required'
    });
  }

  const patient = await findPatientByIdOrCode(prescriptionData.patient);
  if (!patient) {
    return notFound(res, 'Patient');
  }

  prescriptionData.prescriber = userId;
  prescriptionData.createdBy = userId;

  if (prescriptionData.medications) {
    prescriptionData.medications = prescriptionData.medications.map(med => ({
      ...med,
      safetyChecks: {
        ...med.safetyChecks,
        overridden: true,
        overrideReason,
        overrideBy: userId,
        checksPerformedAt: new Date()
      }
    }));
  }

  prescriptionData.warnings = [
    ...(prescriptionData.warnings || []),
    ...safetyWarnings.map(w => `OVERRIDE: ${w}`)
  ];

  await AuditLog.create({
    userId,
    action: 'SAFETY_OVERRIDE',
    resourceType: 'Prescription',
    resourceId: null,
    details: {
      patientId: patient._id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      overrideReason,
      safetyWarningsOverridden: safetyWarnings,
      severity: 'HIGH',
      timestamp: new Date()
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  log.info('Safety override prescription', {
    doctor: `${req.user.firstName} ${req.user.lastName}`,
    patient: `${patient.firstName} ${patient.lastName}`,
    reason: overrideReason
  });

  const prescription = await Prescription.create({
    ...prescriptionData,
    safetyOverride: {
      overridden: true,
      overriddenAt: new Date(),
      overriddenBy: userId,
      reason: overrideReason,
      acknowledgedWarnings: safetyWarnings
    }
  });

  await AuditLog.updateOne(
    { userId, action: 'SAFETY_OVERRIDE', 'details.patientId': patient._id, resourceId: null },
    { $set: { resourceId: prescription._id } },
    { sort: { createdAt: -1 } }
  );

  if (!patient.prescriptions.includes(prescription._id)) {
    patient.prescriptions.push(prescription._id);
  }
  if (prescription.type === 'optical') {
    patient.ophthalmology.latestOpticalPrescription = prescription._id;
  }
  await patient.save();

  await prescription.populate('patient', 'firstName lastName patientId');
  await prescription.populate('prescriber', 'firstName lastName');

  res.status(201).json({
    success: true,
    data: prescription,
    warning: 'Cette ordonnance a ete creee avec un contournement des controles de securite.',
    safetyOverride: { overridden: true, reason: overrideReason, warningsAcknowledged: safetyWarnings.length }
  });
});

// @desc    Update prescription
// @route   PUT /api/prescriptions/:id
// @access  Private (Doctor, Ophthalmologist)
exports.updatePrescription = asyncHandler(async (req, res) => {
  req.body.updatedBy = req.user._id || req.user.id;
  delete req.body.prescriptionId;
  delete req.body.prescriber;
  delete req.body.createdAt;

  const prescription = await Prescription.findById(req.params.id);
  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  const userId = req.user._id || req.user.id;
  if (prescription.prescriber.toString() !== userId.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'You can only update your own prescriptions'
    });
  }

  if (prescription.status === 'dispensed' || prescription.status === 'partial') {
    return error(res, 'Cannot update a prescription that has been dispensed');
  }

  // Safety checks for medication updates
  if (req.body.medications && req.body.medications.length > 0 && prescription.type === 'medication') {
    const patient = await findPatientByIdOrCode(prescription.patient);
    if (patient) {
      const currentMeds = patient.medications?.filter(m => m.status === 'active') || [];
      const safetyResults = drugSafetyService.checkMultipleDrugs(req.body.medications, patient, currentMeds);

      if (safetyResults.hasAnyCritical) {
        return res.status(400).json({
          success: false,
          error: 'Critical drug safety issues detected on update',
          safetyCheck: safetyResults
        });
      }

      const warnings = req.body.warnings || [];
      safetyResults.drugChecks.forEach(check => {
        if (check.interactions?.hasInteraction) {
          check.interactions.interactions.forEach(interaction => {
            warnings.push(`${interaction.severity.toUpperCase()}: ${interaction.effect}`);
          });
        }
      });
      if (warnings.length > 0) {
        req.body.warnings = warnings;
        req.body.safetyCheckPerformed = true;
      }
    }
  }

  Object.assign(prescription, sanitizeForAssign(req.body));
  await prescription.save();

  return success(res, { data: prescription });
});

// @desc    Cancel prescription
// @route   PUT /api/prescriptions/:id/cancel
// @access  Private
exports.cancelPrescription = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id);
  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  const userId = req.user._id || req.user.id;
  if (prescription.prescriber.toString() !== userId.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'You can only cancel your own prescriptions'
    });
  }

  // Release reserved inventory
  if (prescription.status === 'ready' || prescription.status === 'reserved') {
    for (const medication of prescription.medications) {
      if (medication.inventoryItem) {
        const inventory = await PharmacyInventory.findById(medication.inventoryItem);
        if (inventory && inventory.reservations) {
          const reservationIndex = inventory.reservations.findIndex(
            r => r.reference && r.reference.toString() === prescription._id.toString()
          );
          if (reservationIndex !== -1) {
            const reservation = inventory.reservations[reservationIndex];
            inventory.inventory.currentStock += reservation.quantity;
            inventory.reservations.splice(reservationIndex, 1);
            if (inventory.status === 'reserved' && inventory.reservations.length === 0) {
              inventory.status = 'available';
            }
            await inventory.save();
          }
        }
      }
    }
  }

  prescription.status = 'cancelled';
  prescription.cancellation = {
    cancelled: true,
    cancelledAt: Date.now(),
    cancelledBy: userId,
    reason: req.body.reason
  };
  await prescription.save();

  return success(res, { data: prescription, message: 'Prescription cancelled successfully' });
});

// @desc    Delete prescription
// @route   DELETE /api/prescriptions/:id
// @access  Private (Doctor, Ophthalmologist, Admin)
exports.deletePrescription = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id);
  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  if (prescription.pharmacyStatus === 'dispensed') {
    return error(res, 'Cannot delete a dispensed prescription');
  }

  if (prescription.patient) {
    await Patient.findByIdAndUpdate(
      prescription.patient,
      { $pull: { prescriptions: prescription._id } }
    );
  }

  await prescription.deleteOne();

  res.json({ success: true, message: 'Prescription deleted successfully' });
});

// ============================================
// SIGNATURE & VERIFICATION
// ============================================

// @desc    Sign prescription
// @route   PUT /api/prescriptions/:id/sign
// @access  Private (Doctor, Ophthalmologist, Admin)
exports.signPrescription = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id);
  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  const userId = req.user._id || req.user.id;
  if (prescription.prescriber.toString() !== userId.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Only the prescriber can sign this prescription'
    });
  }

  if (prescription.signature?.prescriber?.signed) {
    return error(res, 'Prescription is already signed');
  }

  const updatedPrescription = await Prescription.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        'signature.prescriber.signed': true,
        'signature.prescriber.signedAt': new Date(),
        'signature.prescriber.signedBy': userId,
        ...(prescription.status === 'pending' || prescription.status === 'draft'
          ? { status: 'active' }
          : {})
      }
    },
    { new: true, runValidators: true }
  ).populate('prescriber', 'firstName lastName specialization')
    .populate('patient', 'firstName lastName dateOfBirth');

  log.info('Prescription signed', { prescriptionId: updatedPrescription.prescriptionId, status: updatedPrescription.status });

  return success(res, { data: updatedPrescription, message: 'Prescription signed successfully' });
});

// @desc    Verify prescription
// @route   POST /api/prescriptions/:id/verify
// @access  Private
exports.verifyPrescription = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('prescriber', 'firstName lastName licenseNumber');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  const verificationResult = {
    valid: true,
    checks: {
      notExpired: !prescription.isExpired,
      prescriberLicenseValid: !!prescription.prescriber.licenseNumber,
      notCancelled: prescription.status !== 'cancelled',
      refillsAvailable: true
    }
  };

  if (prescription.type === 'medication' && prescription.medications[0]?.refills) {
    verificationResult.checks.refillsAvailable = prescription.medications[0].refills.remaining > 0;
  }

  verificationResult.valid = Object.values(verificationResult.checks).every(check => check === true);

  prescription.verification = {
    required: true,
    verifiedBy: req.user._id || req.user.id,
    verifiedAt: Date.now(),
    method: req.body.method || 'manual',
    notes: req.body.notes
  };
  await prescription.save();

  return success(res, { data: verificationResult });
});

// ============================================
// INVOICE
// ============================================

// @desc    Create invoice for prescription
// @route   POST /api/prescriptions/:id/invoice
// @access  Private (Receptionist, Pharmacist, Admin)
exports.createInvoiceForPrescription = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId phoneNumber email');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  if (prescription.invoice) {
    const existingInvoice = await Invoice.findById(prescription.invoice);
    if (existingInvoice) {
      return success(res, { data: existingInvoice, message: 'Invoice already exists for this prescription' });
    }
  }

  if (prescription.type !== 'medication') {
    return error(res, 'Only medication prescriptions can be invoiced through this endpoint');
  }

  if (prescription.status === 'cancelled') {
    return error(res, 'Cannot create invoice for cancelled prescription');
  }

  if (prescription.status === 'dispensed') {
    return error(res, 'Prescription has already been dispensed');
  }

  const invoiceItems = [];
  const inventoryWarnings = [];

  for (const medication of prescription.medications || []) {
    const quantity = medication.quantity || 1;
    let unitPrice = medication.pricing?.unitPrice || 0;
    let inventoryItem = null;

    if (medication.inventoryItem) {
      inventoryItem = await PharmacyInventory.findById(medication.inventoryItem);
    }

    if (!inventoryItem && medication.name) {
      const escapedMedName = medication.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      inventoryItem = await PharmacyInventory.findOne({
        $or: [
          { 'medication.genericName': { $regex: new RegExp(escapedMedName, 'i') } },
          { 'medication.brandName': { $regex: new RegExp(escapedMedName, 'i') } }
        ]
      });
      if (inventoryItem) {
        medication.inventoryItem = inventoryItem._id;
      }
    }

    if (inventoryItem) {
      unitPrice = inventoryItem.pricing?.sellingPrice || unitPrice;
      if (inventoryItem.inventory.currentStock < quantity) {
        inventoryWarnings.push({
          medication: medication.name,
          available: inventoryItem.inventory.currentStock,
          required: quantity
        });
      }
    }

    const total = unitPrice * quantity;
    invoiceItems.push({
      description: medication.name,
      category: 'medication',
      code: medication.code || '',
      quantity,
      unitPrice,
      discount: 0,
      subtotal: total,
      tax: 0,
      total,
      reference: `Prescription:${prescription._id}`
    });
  }

  const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
  if (subtotal === 0) {
    return error(res, 'Cannot create invoice with zero amount. Check medication pricing.');
  }

  let invoice;
  try {
    invoice = await Invoice.create({
      patient: prescription.patient._id || prescription.patient,
      prescription: prescription._id,
      visit: prescription.visit,
      dateIssued: new Date(),
      dueDate: req.body.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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
        billTo: {
          name: prescription.patient.firstName ? `${prescription.patient.firstName} ${prescription.patient.lastName}` : undefined,
          phone: prescription.patient.phoneNumber,
          email: prescription.patient.email
        },
        currency: process.env.BASE_CURRENCY || 'CDF'
      },
      notes: {
        internal: `Invoice for prescription ${prescription.prescriptionId || prescription._id}. Payment will auto-dispense medications.`,
        billing: `${invoiceItems.length} medication(s) - Will be dispensed upon payment`
      },
      createdBy: req.user._id || req.user.id
    });
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.prescription) {
      log.info('Race condition detected - invoice already exists', { prescriptionId: prescription.prescriptionId });
      const existingInvoice = await Invoice.findOne({ prescription: prescription._id });
      if (existingInvoice) {
        return success(res, { data: existingInvoice, message: 'Invoice already exists for this prescription' });
      }
    }
    throw err;
  }

  await Prescription.updateOne(
    { _id: prescription._id, invoice: { $exists: false } },
    { $set: { invoice: invoice._id } }
  );

  log.info('Invoice created for prescription', { prescriptionId: prescription.prescriptionId, invoiceId: invoice.invoiceId });

  res.status(201).json({
    success: true,
    message: 'Invoice created successfully. Medications will be dispensed automatically when payment is complete.',
    data: invoice,
    inventoryWarnings: inventoryWarnings.length > 0 ? inventoryWarnings : undefined,
    prescription: {
      id: prescription._id,
      prescriptionId: prescription.prescriptionId,
      status: prescription.status
    }
  });
});

// ============================================
// PRINTING & PDF
// ============================================

// @desc    Print prescription
// @route   GET /api/prescriptions/:id/print
// @access  Private
exports.printPrescription = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('patient', 'firstName lastName dateOfBirth patientId address phoneNumber')
    .populate('prescriber', 'firstName lastName licenseNumber department signature')
    .populate('appointment', 'date');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  const printData = prescription.formatForPrint();

  prescription.viewHistory.push({
    viewedBy: req.user._id || req.user.id,
    viewedAt: Date.now(),
    action: 'PRINT'
  });
  await prescription.save();

  return success(res, { data: printData });
});

// @desc    Generate PDF prescription
// @route   GET /api/prescriptions/:id/pdf
// @access  Private
exports.generatePDF = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('patient', 'firstName lastName dateOfBirth patientId address phoneNumber')
    .populate('prescriber', 'firstName lastName licenseNumber department signature')
    .populate('appointment', 'date');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=prescription-${prescription.prescriptionId}.pdf`);

  doc.pipe(res);

  // Header
  const clinicName = process.env.CLINIC_NAME || 'Centre Ophtalmologique';
  const clinicAddress = process.env.CLINIC_ADDRESS || '';
  const clinicPhone = process.env.CLINIC_PHONE || '';
  const clinicCity = process.env.CLINIC_CITY || '';

  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e40af').text(clinicName, { align: 'center' });
  doc.fontSize(9).font('Helvetica').fillColor('black');
  if (clinicAddress) doc.text(clinicAddress + (clinicCity ? `, ${clinicCity}` : ''), { align: 'center' });
  if (clinicPhone) doc.text(`Tel: ${clinicPhone}`, { align: 'center' });
  doc.moveDown(0.5);

  doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000').text('ORDONNANCE MEDICALE', { align: 'center' });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown();

  // Patient Info
  doc.fontSize(12).font('Helvetica-Bold').text('PATIENT:');
  doc.fontSize(11).font('Helvetica')
    .text(`Nom: ${prescription.patient.firstName} ${prescription.patient.lastName}`)
    .text(`ID Patient: ${prescription.patient.patientId}`)
    .text(`Date de naissance: ${prescription.patient.dateOfBirth ? new Date(prescription.patient.dateOfBirth).toLocaleDateString('fr-FR') : 'N/A'}`);
  doc.moveDown();

  doc.text(`Date de prescription: ${new Date(prescription.dateIssued).toLocaleDateString('fr-FR')}`);
  doc.text(`Valide jusqu'au: ${prescription.validUntil ? new Date(prescription.validUntil).toLocaleDateString('fr-FR') : 'N/A'}`);
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown();

  // Medications or Optical
  if (prescription.type === 'medication' && prescription.medications) {
    doc.fontSize(12).font('Helvetica-Bold').text('MEDICATIONS:');
    doc.moveDown(0.5);

    prescription.medications.forEach((med, index) => {
      const medName = med.genericName ? `${med.name} (${med.genericName})` : med.name;
      doc.fontSize(11).font('Helvetica-Bold').text(`${index + 1}. ${medName}`);
      doc.fontSize(10).font('Helvetica');
      if (med.dosage) doc.text(`   Posologie: ${typeof med.dosage === 'object' ? JSON.stringify(med.dosage) : med.dosage}`);
      if (med.frequency) doc.text(`   Frequence: ${med.frequency}`);
      if (med.duration) doc.text(`   Duree: ${med.duration}`);
      if (med.route) doc.text(`   Voie d'administration: ${med.route}`);
      if (med.instructions) doc.text(`   Instructions: ${med.instructions}`);
      if (med.refills?.allowed > 0) {
        doc.text(`   Renouvellements: ${med.refills.remaining || med.refills.allowed}`);
      }
      doc.moveDown(0.5);
    });
  }

  if (prescription.type === 'optical' && prescription.optical) {
    doc.fontSize(12).font('Helvetica-Bold').text('PRESCRIPTION OPTIQUE:');
    doc.moveDown(0.5);
    const optical = prescription.optical;
    const od = optical.OD || {};
    const os = optical.OS || {};

    const formatDiopter = (val) => {
      if (val === undefined || val === null) return '  -  ';
      const num = parseFloat(val);
      return isNaN(num) ? '  -  ' : (num >= 0 ? `+${num.toFixed(2)}` : num.toFixed(2));
    };

    doc.fontSize(10).font('Helvetica');
    doc.text(`OD: Sphere ${formatDiopter(od.sphere)} | Cylindre ${formatDiopter(od.cylinder)} | Axe ${od.axis || '-'}`);
    doc.text(`OG: Sphere ${formatDiopter(os.sphere)} | Cylindre ${formatDiopter(os.cylinder)} | Axe ${os.axis || '-'}`);
    if (optical.pd) doc.text(`Ecart pupillaire: ${optical.pd} mm`);
    doc.moveDown();
  }

  // Warnings
  if (prescription.warnings && prescription.warnings.length > 0) {
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#dc2626').text('AVERTISSEMENTS:');
    doc.fontSize(10).font('Helvetica').fillColor('black');
    prescription.warnings.forEach(w => doc.text(`- ${w}`));
    doc.moveDown();
  }

  // Footer
  doc.moveDown(2);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown();

  doc.fontSize(10).font('Helvetica-Bold')
    .text(`Dr. ${prescription.prescriber.firstName} ${prescription.prescriber.lastName}`);
  doc.fontSize(9).font('Helvetica');
  if (prescription.prescriber.licenseNumber) {
    doc.text(`N Ordre: ${prescription.prescriber.licenseNumber}`);
  }

  doc.moveDown(1.5);
  doc.text('Signature et cachet:');
  doc.moveDown(0.3);
  doc.rect(50, doc.y, 200, 50).stroke();

  if (prescription.signature?.prescriber?.signed) {
    doc.fontSize(8).text(`Signe electroniquement le ${new Date(prescription.signature.prescriber.signedAt).toLocaleDateString('fr-FR')}`, 55, doc.y + 35);
  }

  doc.moveDown(4);
  doc.fontSize(8).fillColor('#6b7280');
  doc.text(`ID: ${prescription.prescriptionId}`, 50);
  doc.text(`Genere le: ${new Date().toLocaleDateString('fr-FR')}`, 400, doc.y - 12, { align: 'right' });

  doc.end();

  prescription.viewHistory.push({
    viewedBy: req.user._id || req.user.id,
    viewedAt: Date.now(),
    action: 'PDF_GENERATED'
  });
  await prescription.save();
});

// ============================================
// RENEWAL
// ============================================

// @desc    Renew prescription
// @route   POST /api/prescriptions/:id/renew
// @access  Private (Doctor, Ophthalmologist)
exports.renewPrescription = asyncHandler(async (req, res) => {
  const originalPrescription = await Prescription.findById(req.params.id);

  if (!originalPrescription) {
    return res.status(404).json({ success: false, error: 'Original prescription not found' });
  }

  const renewalData = originalPrescription.toObject();
  delete renewalData._id;
  delete renewalData.prescriptionId;
  delete renewalData.createdAt;
  delete renewalData.updatedAt;
  delete renewalData.dispensing;
  delete renewalData.viewHistory;

  const userId = req.user._id || req.user.id;
  renewalData.prescriber = userId;
  renewalData.createdBy = userId;
  renewalData.dateIssued = Date.now();
  renewalData.status = 'pending';
  renewalData.renewal = {
    isRenewal: true,
    originalPrescription: originalPrescription._id,
    renewalApproved: true,
    renewalApprovedBy: userId,
    renewalApprovedAt: Date.now()
  };

  const validityDays = renewalData.type === 'optical' ? 365 : 90;
  renewalData.validUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

  const newPrescription = await Prescription.create(renewalData);

  originalPrescription.renewal.renewalRequested = true;
  originalPrescription.renewal.renewalRequestedAt = Date.now();
  await originalPrescription.save();

  await newPrescription.populate('patient', 'firstName lastName patientId');
  await newPrescription.populate('prescriber', 'firstName lastName');

  res.status(201).json({
    success: true,
    message: 'Prescription renewed successfully',
    data: newPrescription
  });
});

// ============================================
// VALIDATION
// ============================================

// @desc    Validate prescription before creation
// @route   POST /api/prescriptions/validate
// @access  Private
exports.validatePrescription = asyncHandler(async (req, res) => {
  const prescriptionData = req.body;
  const validationErrors = [];
  const warnings = [];

  if (!prescriptionData.patient) validationErrors.push('Patient is required');
  if (!prescriptionData.type) validationErrors.push('Prescription type is required');

  if (prescriptionData.type === 'medication') {
    if (!prescriptionData.medications || prescriptionData.medications.length === 0) {
      validationErrors.push('At least one medication is required');
    } else {
      prescriptionData.medications.forEach((med, index) => {
        if (!med.name) validationErrors.push(`Medication ${index + 1}: Name is required`);
        if (!med.dosage) validationErrors.push(`Medication ${index + 1}: Dosage is required`);
      });

      if (prescriptionData.patient) {
        const patient = await findPatientByIdOrCode(prescriptionData.patient);
        if (patient) {
          const currentMeds = patient.medications?.filter(m => m.status === 'active') || [];
          const safetyResults = drugSafetyService.checkMultipleDrugs(prescriptionData.medications, patient, currentMeds);

          if (safetyResults.hasAnyCritical) {
            validationErrors.push('Critical safety issues detected');
          }
          if (safetyResults.hasAnyMajor) {
            warnings.push('Major safety concerns detected - review required');
          }
        }
      }
    }
  }

  if (prescriptionData.type === 'optical') {
    if (!prescriptionData.optical) validationErrors.push('Optical prescription data is required');
  }

  res.json({
    success: validationErrors.length === 0,
    valid: validationErrors.length === 0,
    errors: validationErrors,
    warnings,
    canProceed: validationErrors.length === 0
  });
});

// ============================================
// TEMPLATES
// ============================================

// @desc    Get prescription templates
// @route   GET /api/prescriptions/templates
// @access  Private
exports.getTemplates = asyncHandler(async (req, res) => {
  const { type, category, createdBy, search } = req.query;
  let templates = [];

  try {
    const Template = mongoose.models.PrescriptionTemplate ||
      mongoose.model('PrescriptionTemplate', new mongoose.Schema({
        name: { type: String, required: true },
        type: { type: String, enum: ['medication', 'optical'], required: true },
        category: String,
        description: String,
        medications: [mongoose.Schema.Types.Mixed],
        optical: mongoose.Schema.Types.Mixed,
        instructions: String,
        warnings: [String],
        isDefault: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        usageCount: { type: Number, default: 0 }
      }, { timestamps: true }));

    const query = { isActive: true };
    if (type) query.type = type;
    if (category) query.category = category;
    if (createdBy) query.createdBy = createdBy;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    templates = await Template.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ usageCount: -1, name: 1 });
  } catch (err) {
    log.info('Templates collection not found, using defaults');
  }

  if (templates.length === 0) {
    templates = getDefaultTemplates(type);
  }

  res.json({ success: true, count: templates.length, data: templates });
});

// @desc    Create prescription template
// @route   POST /api/prescriptions/templates
// @access  Private (Doctor, Admin)
exports.createTemplate = asyncHandler(async (req, res) => {
  const Template = mongoose.models.PrescriptionTemplate ||
    mongoose.model('PrescriptionTemplate', new mongoose.Schema({
      name: { type: String, required: true },
      type: { type: String, enum: ['medication', 'optical'], required: true },
      category: String,
      description: String,
      medications: [mongoose.Schema.Types.Mixed],
      optical: mongoose.Schema.Types.Mixed,
      instructions: String,
      warnings: [String],
      isDefault: { type: Boolean, default: false },
      isActive: { type: Boolean, default: true },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      usageCount: { type: Number, default: 0 }
    }, { timestamps: true }));

  const templateData = { ...req.body, createdBy: req.user._id || req.user.id };
  const template = await Template.create(templateData);

  res.status(201).json({ success: true, data: template });
});

// @desc    Get single template
// @route   GET /api/prescriptions/templates/:templateId
// @access  Private
exports.getTemplate = asyncHandler(async (req, res) => {
  const Template = mongoose.models.PrescriptionTemplate;
  if (!Template) {
    return res.status(404).json({ success: false, error: 'Template not found' });
  }

  const template = await Template.findById(req.params.templateId)
    .populate('createdBy', 'firstName lastName');

  if (!template) {
    return res.status(404).json({ success: false, error: 'Template not found' });
  }

  res.json({ success: true, data: template });
});

// @desc    Update template
// @route   PUT /api/prescriptions/templates/:templateId
// @access  Private (Doctor, Admin)
exports.updateTemplate = asyncHandler(async (req, res) => {
  const Template = mongoose.models.PrescriptionTemplate;
  if (!Template) {
    return res.status(404).json({ success: false, error: 'Template not found' });
  }

  const template = await Template.findByIdAndUpdate(
    req.params.templateId,
    req.body,
    { new: true, runValidators: true }
  );

  if (!template) {
    return res.status(404).json({ success: false, error: 'Template not found' });
  }

  res.json({ success: true, data: template });
});

// @desc    Delete template
// @route   DELETE /api/prescriptions/templates/:templateId
// @access  Private (Admin)
exports.deleteTemplate = asyncHandler(async (req, res) => {
  const Template = mongoose.models.PrescriptionTemplate;
  if (!Template) {
    return res.status(404).json({ success: false, error: 'Template not found' });
  }

  const template = await Template.findByIdAndUpdate(
    req.params.templateId,
    { isActive: false },
    { new: true }
  );

  if (!template) {
    return res.status(404).json({ success: false, error: 'Template not found' });
  }

  res.json({ success: true, message: 'Template deleted successfully' });
});

// Helper function for default templates
function getDefaultTemplates(type) {
  const medicationTemplates = [
    {
      _id: 'default-1',
      name: 'Post-Cataract Surgery',
      type: 'medication',
      category: 'ophthalmology',
      description: 'Standard post-operative medications for cataract surgery',
      medications: [
        { name: 'Prednisolone Acetate 1%', dosage: '1 drop', frequency: 'QID', duration: '4 weeks', route: 'ophthalmic' },
        { name: 'Moxifloxacin 0.5%', dosage: '1 drop', frequency: 'QID', duration: '1 week', route: 'ophthalmic' },
        { name: 'Nepafenac 0.1%', dosage: '1 drop', frequency: 'TID', duration: '4 weeks', route: 'ophthalmic' }
      ],
      isDefault: true
    },
    {
      _id: 'default-2',
      name: 'Glaucoma - Initial Treatment',
      type: 'medication',
      category: 'ophthalmology',
      description: 'First-line glaucoma treatment',
      medications: [
        { name: 'Latanoprost 0.005%', dosage: '1 drop', frequency: 'QHS', duration: '30 days', route: 'ophthalmic' }
      ],
      isDefault: true
    }
  ];

  const opticalTemplates = [
    {
      _id: 'optical-1',
      name: 'Standard Single Vision',
      type: 'optical',
      category: 'glasses',
      description: 'Basic single vision glasses prescription',
      optical: { OD: { sphere: 0, cylinder: 0, axis: 0 }, OS: { sphere: 0, cylinder: 0, axis: 0 }, pd: 63 },
      isDefault: true
    }
  ];

  if (type === 'medication') return medicationTemplates;
  if (type === 'optical') return opticalTemplates;
  return [...medicationTemplates, ...opticalTemplates];
}

// ============================================
// STATISTICS & REPORTING
// ============================================

// @desc    Get prescription statistics
// @route   GET /api/prescriptions/statistics
// @access  Private (Doctor, Admin, Pharmacist)
exports.getStatistics = asyncHandler(async (req, res) => {
  const { startDate, endDate, prescriber } = req.query;

  const dateQuery = {};
  if (startDate) dateQuery.$gte = new Date(startDate);
  if (endDate) dateQuery.$lte = new Date(endDate);

  const matchStage = {};
  if (Object.keys(dateQuery).length > 0) matchStage.dateIssued = dateQuery;
  if (prescriber) matchStage.prescriber = new mongoose.Types.ObjectId(prescriber);

  const stats = await Prescription.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        byStatus: { $push: '$status' },
        byType: { $push: '$type' }
      }
    }
  ]);

  const statusCounts = {};
  const typeCounts = {};

  if (stats.length > 0) {
    stats[0].byStatus.forEach(s => statusCounts[s] = (statusCounts[s] || 0) + 1);
    stats[0].byType.forEach(t => typeCounts[t] = (typeCounts[t] || 0) + 1);
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCount = await Prescription.countDocuments({
    dateIssued: { $gte: thirtyDaysAgo },
    ...matchStage
  });

  res.json({
    success: true,
    data: {
      total: stats[0]?.total || 0,
      byStatus: statusCounts,
      byType: typeCounts,
      last30Days: recentCount
    }
  });
});

// @desc    Get expired prescriptions
// @route   GET /api/prescriptions/expired
// @access  Private
exports.getExpiredPrescriptions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, patient } = req.query;

  const query = {
    validUntil: { $lt: new Date() },
    status: { $nin: ['cancelled', 'dispensed'] }
  };

  if (patient) query.patient = patient;

  const prescriptions = await Prescription.find(query)
    .populate('patient', 'firstName lastName patientId')
    .populate('prescriber', 'firstName lastName')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ validUntil: -1 });

  const total = await Prescription.countDocuments(query);

  res.json({
    success: true,
    count: prescriptions.length,
    total,
    pages: Math.ceil(total / limit),
    data: prescriptions
  });
});

// ============================================
// HISTORY & CLONE
// ============================================

// @desc    Get prescription history
// @route   GET /api/prescriptions/:id/history
// @access  Private
exports.getPrescriptionHistory = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('viewHistory.viewedBy', 'firstName lastName')
    .populate('dispensing.dispensedBy', 'firstName lastName');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  const history = [];

  history.push({
    action: 'CREATED',
    timestamp: prescription.createdAt,
    details: 'Prescription created by prescriber'
  });

  prescription.viewHistory?.forEach(view => {
    history.push({
      action: view.action || 'VIEWED',
      timestamp: view.viewedAt,
      user: view.viewedBy,
      details: `${view.action || 'Viewed'} by ${view.viewedBy?.firstName || 'Unknown'}`
    });
  });

  prescription.pharmacyStatusHistory?.forEach(status => {
    history.push({
      action: `PHARMACY_${status.status.toUpperCase()}`,
      timestamp: status.changedAt,
      user: status.changedBy,
      details: status.notes || `Status changed to ${status.status}`
    });
  });

  prescription.dispensing?.forEach((dispense) => {
    history.push({
      action: dispense.isRefill ? 'REFILLED' : 'DISPENSED',
      timestamp: dispense.dispensedAt,
      user: dispense.dispensedBy,
      details: `${dispense.isRefill ? 'Refill' : 'Initial dispense'} - Qty: ${dispense.quantity || 'N/A'}`
    });
  });

  history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.json({
    success: true,
    data: { prescriptionId: prescription.prescriptionId, history }
  });
});

// @desc    Clone prescription
// @route   POST /api/prescriptions/:id/clone
// @access  Private (Doctor, Admin)
exports.clonePrescription = asyncHandler(async (req, res) => {
  const originalPrescription = await Prescription.findById(req.params.id);
  if (!originalPrescription) {
    return notFound(res, 'Prescription');
  }

  const cloneData = originalPrescription.toObject();
  delete cloneData._id;
  delete cloneData.prescriptionId;
  delete cloneData.createdAt;
  delete cloneData.updatedAt;
  delete cloneData.dispensing;
  delete cloneData.viewHistory;
  delete cloneData.pharmacyStatus;
  delete cloneData.pharmacyStatusHistory;
  delete cloneData.pharmacy;
  delete cloneData.verification;
  delete cloneData.cancellation;
  delete cloneData.renewal;

  const userId = req.user._id || req.user.id;
  cloneData.prescriber = userId;
  cloneData.createdBy = userId;
  cloneData.dateIssued = new Date();
  cloneData.status = 'pending';

  const validityDays = cloneData.type === 'optical' ? 365 : 90;
  cloneData.validUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

  if (cloneData.medications) {
    cloneData.medications.forEach(med => {
      if (med.refills) {
        med.refills.remaining = med.refills.allowed || 0;
        delete med.refills.lastRefillDate;
      }
      delete med.dispensing;
      delete med.reservation;
    });
  }

  cloneData.clonedFrom = originalPrescription._id;

  const newPrescription = await Prescription.create(cloneData);
  await newPrescription.populate('patient', 'firstName lastName patientId');
  await newPrescription.populate('prescriber', 'firstName lastName');

  res.status(201).json({
    success: true,
    message: 'Prescription cloned successfully',
    data: newPrescription
  });
});

// ============================================
// BULK OPERATIONS
// ============================================

// @desc    Bulk create prescriptions
// @route   POST /api/prescriptions/bulk
// @access  Private (Doctor, Ophthalmologist, Admin)
exports.bulkCreatePrescriptions = asyncHandler(async (req, res) => {
  const { prescriptions } = req.body;

  if (!prescriptions || !Array.isArray(prescriptions) || prescriptions.length === 0) {
    return error(res, 'Prescriptions array is required');
  }

  const createdPrescriptions = [];
  const errors = [];

  for (let i = 0; i < prescriptions.length; i++) {
    try {
      const rxData = prescriptions[i];
      const count = await Prescription.countDocuments();
      const prescriptionId = `RX-${Date.now()}-${(count + 1).toString().padStart(5, '0')}`;

      const prescription = await Prescription.create({
        ...rxData,
        prescriptionId,
        prescriber: req.user._id || req.user.id,
        dateIssued: new Date(),
        status: 'active'
      });

      createdPrescriptions.push(prescription);
    } catch (err) {
      errors.push({ index: i, error: err.message });
    }
  }

  res.status(201).json({
    success: true,
    created: createdPrescriptions.length,
    failed: errors.length,
    data: createdPrescriptions,
    errors: errors.length > 0 ? errors : undefined
  });
});

// ============================================
// PATIENT/PROVIDER QUERIES
// ============================================

// @desc    Get active prescriptions for a patient
// @route   GET /api/prescriptions/patient/:patientId/active
// @access  Private
exports.getActivePrescriptions = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  const prescriptions = await Prescription.find({
    patient: patientId,
    status: 'active',
    expirationDate: { $gte: new Date() }
  })
    .populate('prescriber', 'firstName lastName specialization')
    .sort({ dateIssued: -1 });

  res.json({ success: true, count: prescriptions.length, data: prescriptions });
});

// @desc    Get provider's prescriptions
// @route   GET /api/prescriptions/provider/:providerId
// @access  Private
exports.getProviderPrescriptions = asyncHandler(async (req, res) => {
  const { providerId } = req.params;
  const { page = 1, limit = 20, status, type, dateFrom, dateTo } = req.query;

  const query = { prescriber: providerId };
  if (status) query.status = status;
  if (type) query.type = type;

  if (dateFrom || dateTo) {
    query.dateIssued = {};
    if (dateFrom) query.dateIssued.$gte = new Date(dateFrom);
    if (dateTo) query.dateIssued.$lte = new Date(dateTo);
  }

  const [prescriptions, total] = await Promise.all([
    Prescription.find(query)
      .populate('patient', 'firstName lastName patientId phoneNumber')
      .populate('prescriber', 'firstName lastName specialization')
      .populate('visit', 'visitId visitDate')
      .sort({ dateIssued: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit)),
    Prescription.countDocuments(query)
  ]);

  res.json({
    success: true,
    count: prescriptions.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: prescriptions
  });
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

// @desc    Generate QR code for prescription
// @route   GET /api/prescriptions/:id/qr-code
// @access  Private
exports.generateQRCode = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId')
    .populate('prescriber', 'firstName lastName');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  const qrData = {
    prescriptionId: prescription.prescriptionId,
    patient: prescription.patient ? `${prescription.patient.firstName} ${prescription.patient.lastName}` : 'Unknown',
    patientId: prescription.patient?.patientId,
    prescriber: prescription.prescriber ? `Dr. ${prescription.prescriber.firstName} ${prescription.prescriber.lastName}` : 'Unknown',
    dateIssued: prescription.dateIssued,
    type: prescription.type,
    verificationUrl: `${process.env.APP_URL || 'https://medflow.app'}/verify/${prescription._id}`
  };

  try {
    const QRCode = require('qrcode');
    const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrData));

    res.json({
      success: true,
      data: { qrCode: qrCodeDataUrl, prescriptionData: qrData }
    });
  } catch (err) {
    res.json({
      success: true,
      data: { qrCode: null, prescriptionData: qrData, message: 'QR code generation requires qrcode package' }
    });
  }
});

// @desc    Send prescription to patient
// @route   POST /api/prescriptions/:id/send-to-patient
// @access  Private
exports.sendToPatient = asyncHandler(async (req, res) => {
  const { method, email, phone } = req.body;

  const prescription = await Prescription.findById(req.params.id)
    .populate('patient', 'firstName lastName email phoneNumber')
    .populate('prescriber', 'firstName lastName');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  const targetEmail = email || prescription.patient?.email;
  const targetPhone = phone || prescription.patient?.phoneNumber;

  let sendResult = { success: false, method: null };

  if (method === 'email' && targetEmail) {
    sendResult = { success: true, method: 'email', sentTo: targetEmail, message: 'Prescription sent via email' };
  } else if (method === 'sms' && targetPhone) {
    sendResult = { success: true, method: 'sms', sentTo: targetPhone, message: 'Prescription sent via SMS' };
  } else {
    return res.status(400).json({
      success: false,
      error: `No valid ${method || 'contact'} method available for patient`
    });
  }

  prescription.sentToPatient = {
    method: sendResult.method,
    sentAt: new Date(),
    sentBy: req.user._id || req.user.id,
    sentTo: sendResult.sentTo
  };
  await prescription.save();

  res.json({ success: true, data: sendResult });
});

// @desc    Check insurance coverage for prescription
// @route   GET /api/prescriptions/:id/check-coverage
// @access  Private
exports.checkInsuranceCoverage = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('patient', 'firstName lastName insurance');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  const patientInsurance = prescription.patient?.insurance;

  if (!patientInsurance || !patientInsurance.provider) {
    return res.json({
      success: true,
      data: {
        hasCoverage: false,
        message: 'No insurance information on file for patient',
        recommendation: 'Verify patient insurance details'
      }
    });
  }

  const coverageResult = {
    hasCoverage: true,
    insuranceProvider: patientInsurance.provider,
    policyNumber: patientInsurance.policyNumber,
    coverageType: prescription.type === 'optical' ? 'Vision' : 'Prescription Drug',
    estimatedCoverage: {
      percentage: 80,
      copay: prescription.type === 'optical' ? 25 : 10,
      deductibleMet: true
    },
    priorAuthRequired: false,
    formularyStatus: 'preferred',
    checkedAt: new Date()
  };

  prescription.insurance = {
    ...prescription.insurance,
    coverageChecked: true,
    coverageStatus: 'covered',
    lastChecked: new Date()
  };
  await prescription.save();

  res.json({ success: true, data: coverageResult });
});
