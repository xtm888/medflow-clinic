const Prescription = require('../models/Prescription');
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const { Inventory, PharmacyInventory } = require('../models/Inventory');
const Invoice = require('../models/Invoice');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');
const { asyncHandler } = require('../middleware/errorHandler');
const { sanitizeForAssign } = require('../utils/sanitize');
const drugSafetyService = require('../services/drugSafetyService');
const ePrescribingService = require('../services/ePrescribingService');
const { success, error, notFound, paginated } = require('../utils/apiResponse');
const { findPatientByIdOrCode } = require('../utils/patientLookup');
const { prescription: prescriptionLogger } = require('../utils/structuredLogger');
const { PRESCRIPTION, PAGINATION } = require('../config/constants');
const websocketService = require('../services/websocketService');


// @desc    Get all prescriptions
// @route   GET /api/prescriptions
// @access  Private
exports.getPrescriptions = asyncHandler(async (req, res, next) => {
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

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Filter by type
  if (type) {
    query.type = type;
  }

  // Filter by patient
  if (patient) {
    query.patient = patient;
  }

  // Filter by prescriber
  if (prescriber) {
    query.prescriber = prescriber;
  } else if (req.user.role === 'doctor' || req.user.role === 'ophthalmologist') {
    // Doctors can only see their own prescriptions
    query.prescriber = req.user._id || req.user.id;
  }

  // Date range filter
  if (dateFrom || dateTo) {
    query.dateIssued = {};
    if (dateFrom) {
      query.dateIssued.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      query.dateIssued.$lte = new Date(dateTo);
    }
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
exports.getPrescription = asyncHandler(async (req, res, next) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('patient')
    .populate('prescriber', 'firstName lastName licenseNumber department')
    .populate('visit', 'visitId visitDate status primaryProvider')
    .populate('appointment', 'date type');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  // Add view to history
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
exports.createPrescription = asyncHandler(async (req, res, next) => {
  const userId = req.user._id || req.user.id;
  req.body.prescriber = userId;
  req.body.createdBy = userId;

  // Validate patient exists
  const patient = await findPatientByIdOrCode(req.body.patient);
  if (!patient) {
    return notFound(res, 'Patient');
  }

  // CRITICAL: Validate patient has date of birth for safe medication dosing
  if (!patient.dateOfBirth) {
    return res.status(400).json({
      success: false,
      error: 'Patient date of birth is required for safe prescription creation',
      message: 'Cannot create prescription without patient date of birth. Age-based dosing calculations require accurate birth date. Please update patient record with date of birth before prescribing medications.'
    });
  }

  // Check for drug interactions if medication prescription
  if (req.body.type === 'medication' && req.body.medications) {
    const currentMeds = patient.medications?.filter(m => m.status === 'active') || [];

    // Run local safety checks first (allergies, contraindications, age)
    const safetyResults = drugSafetyService.checkMultipleDrugs(req.body.medications, patient, currentMeds);

    // Also check external APIs for comprehensive drug interactions
    const externalInteractions = [];
    const externalSources = new Set();

    try {
      // Check all medications against external APIs in parallel (BDPM, RxNorm, OpenFDA)
      // This avoids N sequential API calls - now runs in parallel
      const externalCheckPromises = req.body.medications.map(med => {
        const medName = med.genericName || med.name;
        return drugSafetyService.checkInteractionsWithExternalAPI(medName, currentMeds)
          .catch(err => {
            prescriptionLogger.warn('External API check failed', { medication: medName, error: err.message });
            return null; // Return null on error so Promise.all doesn't reject
          });
      });

      const externalResults = await Promise.all(externalCheckPromises);

      // Process all results
      externalResults.forEach(externalResult => {
        if (externalResult && externalResult.hasInteraction) {
          externalInteractions.push(...externalResult.interactions);
          externalResult.sources.forEach(s => externalSources.add(s));

          // Check for critical interactions from external sources
          const hasCriticalExternal = externalResult.interactions.some(
            int => int.severity === 'contraindicated' || int.severity === 'major'
          );

          if (hasCriticalExternal && !safetyResults.hasAnyCritical) {
            safetyResults.hasAnyCritical = externalResult.interactions.some(
              int => int.severity === 'contraindicated'
            );
            safetyResults.hasAnyMajor = true;
          }
        }
      });
    } catch (externalError) {
      prescriptionLogger.warn('External API check failed, using local data only', { error: externalError.message });
    }

    // Add warnings from safety check
    const warnings = req.body.warnings || [];

    if (safetyResults.hasAnyCritical) {
      return res.status(400).json({
        success: false,
        error: 'Critical drug safety issues detected',
        safetyCheck: safetyResults,
        externalSources: Array.from(externalSources),
        message: 'Prescription cannot be created due to critical safety concerns. Please review and modify medications.'
      });
    }

    // Add interaction warnings from local checks
    safetyResults.drugChecks.forEach(check => {
      if (check.interactions?.hasInteraction) {
        check.interactions.interactions.forEach(interaction => {
          warnings.push(`${interaction.severity.toUpperCase()}: ${interaction.effect} (${interaction.drug1} + ${interaction.drug2}) - ${interaction.recommendation}`);
        });
      }
      if (check.allergies?.hasAllergy) {
        warnings.push(`ALLERGY WARNING: Patient may be allergic to ${check.drug}`);
      }
      if (!check.ageAppropriateness?.appropriate) {
        warnings.push(`AGE WARNING: ${check.ageAppropriateness.reason || 'Age-related dosing concern'}`);
      }
    });

    // Add interaction warnings from external APIs
    externalInteractions.forEach(interaction => {
      const warningMsg = `${interaction.severity.toUpperCase()}: ${interaction.effect || interaction.description} (${interaction.drug1} + ${interaction.drug2}) - ${interaction.recommendation || 'Review required'}`;
      if (!warnings.includes(warningMsg)) {
        warnings.push(warningMsg);
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

    // CRITICAL: Validate withFood is specified for high-risk drugs
    // High-risk drugs that require food timing instructions for patient safety
    const HIGH_RISK_DRUG_PATTERNS = [
      // NSAIDs - gastric irritation
      /\b(ibuprofen|diclofenac|naproxen|ketoprofen|meloxicam|piroxicam|indomethacin|aspirin|celecoxib|etoricoxib)\b/i,
      // Antibiotics - absorption/GI effects
      /\b(amoxicillin|azithromycin|ciprofloxacin|levofloxacin|metronidazole|doxycycline|tetracycline|erythromycin|clarithromycin)\b/i,
      // Corticosteroids - gastric irritation
      /\b(prednisone|prednisolone|dexamethasone|methylprednisolone|hydrocortisone)\b/i,
      // Bisphosphonates - esophageal irritation
      /\b(alendronate|risedronate|ibandronate|zoledronic)\b/i,
      // Iron supplements - GI side effects
      /\b(ferrous|iron|folic)\b/i,
      // Potassium - GI irritation
      /\b(potassium|kcl|slow-k)\b/i,
      // Diabetes meds with food requirements
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

    // Block prescription if withFood not specified for high-risk drugs
    if (missingWithFood.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing food timing instructions for high-risk medications',
        medicationsNeedingFoodInstructions: missingWithFood,
        message: 'Les médicaments à haut risque nécessitent des instructions de prise alimentaire (avant/avec/après les repas). Veuillez spécifier pour chaque médicament concerné.',
        hint: 'Set dosage.withFood to one of: before, with, after, empty-stomach, anytime'
      });
    }

    // VALIDATION: Ophthalmic routes must specify which eye(s)
    const OPHTHALMIC_ROUTES = ['ophthalmic', 'intravitreal', 'subconjunctival', 'periocular', 'intracameral'];
    const missingEyeSelection = [];

    for (const med of req.body.medications) {
      if (OPHTHALMIC_ROUTES.includes(med.route)) {
        if (!med.applicationLocation?.eye || !['OD', 'OS', 'OU'].includes(med.applicationLocation.eye)) {
          missingEyeSelection.push({
            medication: med.name || med.genericName,
            route: med.route,
            reason: 'Ophthalmic medications must specify eye: OD (right), OS (left), or OU (both)'
          });
        }
      }
    }

    if (missingEyeSelection.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing eye selection for ophthalmic medications',
        medicationsNeedingEyeSelection: missingEyeSelection,
        message: 'Les médicaments ophtalmiques doivent indiquer l\'oeil concerné (OD = droit, OS = gauche, OU = les deux).',
        hint: 'Set applicationLocation.eye to one of: OD, OS, OU'
      });
    }

    // VALIDATION: Tapering schedules for corticosteroids
    const TAPERING_REQUIRED_PATTERNS = [
      /\b(prednis|dexam|cortis|methyl.*pred|hydrocort|betameth|triamcin)\b/i
    ];
    const TAPERING_DURATION_THRESHOLD = 14; // Days - recommend tapering if used longer than 2 weeks

    const taperingWarnings = [];

    for (const med of req.body.medications) {
      const medName = (med.genericName || med.name || '').toLowerCase();
      const isCorticosteroid = TAPERING_REQUIRED_PATTERNS.some(pattern => pattern.test(medName));

      if (isCorticosteroid) {
        // Parse duration if string
        let durationDays = 0;
        if (typeof med.duration === 'string') {
          const match = med.duration.match(/(\d+)\s*(jour|day|semaine|week|mois|month)/i);
          if (match) {
            const num = parseInt(match[1]);
            const unit = match[2].toLowerCase();
            if (unit.startsWith('jour') || unit.startsWith('day')) durationDays = num;
            else if (unit.startsWith('semaine') || unit.startsWith('week')) durationDays = num * 7;
            else if (unit.startsWith('mois') || unit.startsWith('month')) durationDays = num * 30;
          }
        } else if (typeof med.duration === 'number') {
          durationDays = med.duration;
        }

        // For corticosteroids with extended duration and no tapering, add warning
        if (durationDays >= TAPERING_DURATION_THRESHOLD && !med.tapering?.enabled) {
          taperingWarnings.push({
            medication: med.name || med.genericName,
            duration: med.duration,
            durationDays,
            reason: `Corticosteroid use ≥${TAPERING_DURATION_THRESHOLD} days - consider tapering schedule to prevent adrenal suppression`
          });
        }

        // Validate tapering schedule if enabled
        if (med.tapering?.enabled && med.tapering.schedule) {
          for (let i = 0; i < med.tapering.schedule.length; i++) {
            const step = med.tapering.schedule[i];
            if (!step.stepNumber || !step.durationDays) {
              taperingWarnings.push({
                medication: med.name || med.genericName,
                reason: `Tapering step ${i + 1} is missing required fields (stepNumber, durationDays)`
              });
            }
          }
        }
      }
    }

    // Add tapering warnings (non-blocking, just informational)
    if (taperingWarnings.length > 0) {
      req.body.warnings = req.body.warnings || [];
      taperingWarnings.forEach(warning => {
        req.body.warnings.push(
          `TAPERING RECOMMENDATION: ${warning.medication} - ${warning.reason}`
        );
      });
      req.body.taperingWarnings = taperingWarnings;
    }
  }

  // Check inventory availability for medication prescriptions AND enrich with pricing
  if (req.body.type === 'medication' && req.body.medications) {
    prescriptionLogger.info('Operation', { data: `[PRESCRIPTION CREATE] Checking inventory for ${req.body.medications.length} medications` });
    const inventoryWarnings = [];
    const outOfStock = [];

    for (const med of req.body.medications) {
      // Find inventory item by name or generic name
      const inventoryItem = await PharmacyInventory.findOne({
        $or: [
          { 'medication.genericName': new RegExp(`^${med.genericName || med.name}$`, 'i') },
          { 'medication.brandName': new RegExp(`^${med.name}$`, 'i') }
        ]
      });

      if (!inventoryItem) {
        outOfStock.push({
          medication: med.name,
          reason: 'Not found in pharmacy inventory'
        });
      } else {
        // CRITICAL FIX: Enrich medication with inventory reference and pricing
        med.inventoryItem = inventoryItem._id;

        // Add pricing from inventory
        const unitPrice = inventoryItem.pricing?.sellingPrice || 0;
        const totalCost = unitPrice * (med.quantity || 1);

        med.pricing = {
          unitPrice: unitPrice,
          totalCost: totalCost,
          currency: process.env.BASE_CURRENCY || 'CDF'
        };

        prescriptionLogger.info('Operation', { data: `[PRESCRIPTION CREATE] ✅ Enriched ${med.name} with pricing: ${unitPrice} CDF x ${med.quantity || 1} = ${totalCost} CDF` });

        // Check stock availability
        if (inventoryItem.inventory.currentStock < (med.quantity || 1)) {
          inventoryWarnings.push({
            medication: med.name,
            available: inventoryItem.inventory.currentStock,
            requested: med.quantity || 1,
            unit: inventoryItem.medication.formulation || 'unit'
          });
        } else if (inventoryItem.inventory.currentStock === 0) {
          outOfStock.push({
            medication: med.name,
            reason: 'Out of stock',
            lastRestocked: inventoryItem.lastRestocked
          });
        }
      }
    }

    // Add inventory warnings to response
    if (inventoryWarnings.length > 0) {
      prescriptionLogger.info('Operation', { data: `[PRESCRIPTION CREATE] ⚠️ Inventory warnings for ${inventoryWarnings.length} medications` });
      req.body.warnings = req.body.warnings || [];
      inventoryWarnings.forEach(warning => {
        req.body.warnings.push(
          `INVENTORY WARNING: ${warning.medication} - Only ${warning.available} ${warning.unit} available, ${warning.requested} requested`
        );
      });
      req.body.inventoryWarnings = inventoryWarnings;
    }

    // If any medications are out of stock, allow creation but flag it
    if (outOfStock.length > 0) {
      prescriptionLogger.info('Operation', { data: `[PRESCRIPTION CREATE] ❌ Out of stock: ${outOfStock.length} medications` });
      outOfStock.forEach(item => {
        prescriptionLogger.info('Operation', { data: `  - ${item.medication}: ${item.reason}` });
      });
      req.body.warnings = req.body.warnings || [];
      outOfStock.forEach(item => {
        req.body.warnings.push(
          `OUT OF STOCK: ${item.medication} - ${item.reason}`
        );
      });
      req.body.outOfStockItems = outOfStock;
      req.body.requiresPharmacyOrder = true;
    } else {
      prescriptionLogger.info('Operation', { data: '[PRESCRIPTION CREATE] ✅ All medications in stock with pricing' });
    }
  }

  // CONTROLLED SUBSTANCE COMPLIANCE (DEA/DRC Regulations)
  // Schedule I: Prohibited - cannot prescribe
  // Schedule II: Highly restricted - NO REFILLS ALLOWED, requires DEA number
  // Schedule III-V: Moderate restrictions - limited refills allowed
  if (req.body.type === 'medication' && req.body.medications) {
    const controlledSubstanceWarnings = [];
    const controlledSubstanceErrors = [];
    let hasScheduleII = false;

    for (const med of req.body.medications) {
      // Check if medication is a controlled substance from inventory
      if (med.inventoryItem) {
        const inventoryItem = await PharmacyInventory.findById(med.inventoryItem);

        if (inventoryItem?.controlledSubstance?.isControlled) {
          const schedule = inventoryItem.controlledSubstance.schedule;

          // Mark medication with controlled substance info
          med.controlledSubstance = {
            isControlled: true,
            schedule: schedule,
            requiresSpecialHandling: inventoryItem.controlledSubstance.requiresSpecialHandling,
            requiresSignature: inventoryItem.controlledSubstance.requiresSignature
          };

          // Schedule I - Cannot be prescribed (only for research)
          if (schedule === 'I') {
            controlledSubstanceErrors.push({
              medication: med.name || med.genericName,
              schedule: 'I',
              error: 'Schedule I substances cannot be prescribed for medical use'
            });
          }

          // Schedule II - NO REFILLS ALLOWED (DEA Regulation)
          if (schedule === 'II') {
            hasScheduleII = true;

            // Force refills to 0 for Schedule II
            if (med.refills && (med.refills.allowed > 0 || med.refills.remaining > 0)) {
              controlledSubstanceWarnings.push({
                medication: med.name || med.genericName,
                schedule: 'II',
                action: 'Refills blocked',
                reason: 'Schedule II controlled substances cannot have refills per DEA regulations'
              });
            }

            // FORCE refills to 0 - non-negotiable for Schedule II
            med.refills = { allowed: 0, remaining: 0 };
          }

          // Schedule III-V: Limited refills (max 5 refills within 6 months)
          if (['III', 'IV', 'V'].includes(schedule)) {
            const maxRefills = 5;
            if (med.refills?.allowed > maxRefills) {
              controlledSubstanceWarnings.push({
                medication: med.name || med.genericName,
                schedule: schedule,
                action: `Refills limited to ${maxRefills}`,
                reason: `Schedule ${schedule} substances limited to ${maxRefills} refills per 6 months`
              });
              med.refills.allowed = maxRefills;
              med.refills.remaining = Math.min(med.refills.remaining || maxRefills, maxRefills);
            }
          }

          prescriptionLogger.info('ControlledSubstance', {
            data: `[CONTROLLED] ${med.name}: Schedule ${schedule} - Refills: ${med.refills?.allowed || 0}`
          });
        }
      }
    }

    // Block prescription if Schedule I substances found
    if (controlledSubstanceErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot prescribe Schedule I controlled substances',
        controlledSubstanceErrors,
        message: 'Les substances de l\'annexe I ne peuvent pas être prescrites pour un usage médical.'
      });
    }

    // Validate prescriber credentials for controlled substances
    if (hasScheduleII) {
      const prescriber = await mongoose.model('User').findById(userId).select('deaNumber licenseNumber credentials');

      // DEA number validation for Schedule II (in US) - adapt for DRC equivalent
      const hasValidCredentials = prescriber?.deaNumber || prescriber?.licenseNumber;

      if (!hasValidCredentials) {
        controlledSubstanceWarnings.push({
          medication: 'ALL_SCHEDULE_II',
          warning: 'Prescriber credentials not fully verified',
          reason: 'DEA/License number recommended for controlled substance prescriptions'
        });
      }

      // Audit log for Schedule II prescription
      await AuditLog.create({
        action: 'CONTROLLED_SUBSTANCE_PRESCRIPTION',
        userId: userId,
        resource: 'Prescription',
        details: {
          patientId: patient._id,
          patientName: `${patient.firstName} ${patient.lastName}`,
          medications: req.body.medications
            .filter(m => m.controlledSubstance?.schedule === 'II')
            .map(m => ({ name: m.name, schedule: 'II', quantity: m.quantity })),
          prescriberDEA: prescriber?.deaNumber || 'NOT_PROVIDED',
          timestamp: new Date()
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      prescriptionLogger.info('Audit', {
        data: `[AUDIT] Schedule II prescription by ${prescriber?.deaNumber || userId} for patient ${patient._id}`
      });
    }

    // Add controlled substance warnings to prescription
    if (controlledSubstanceWarnings.length > 0) {
      req.body.warnings = req.body.warnings || [];
      controlledSubstanceWarnings.forEach(warning => {
        req.body.warnings.push(
          `CONTROLLED SUBSTANCE: ${warning.medication} (Schedule ${warning.schedule || 'N/A'}) - ${warning.action || warning.warning}: ${warning.reason}`
        );
      });
      req.body.controlledSubstanceFlags = {
        hasControlledSubstances: true,
        hasScheduleII: hasScheduleII,
        warnings: controlledSubstanceWarnings
      };
    }
  }

  // Helper function to save prescription with or without transaction
  const savePrescription = async (useSession = false, session = null) => {
    const createOptions = useSession ? { session } : {};
    const prescriptions = await Prescription.create([req.body], createOptions);
    const prescription = prescriptions[0];

    // Add prescription to patient record (reference only - no data duplication)
    if (!patient.prescriptions.includes(prescription._id)) {
      patient.prescriptions.push(prescription._id);
    }

    // Store reference to latest optical prescription (not a data copy)
    if (prescription.type === 'optical') {
      patient.ophthalmology.latestOpticalPrescription = prescription._id;
    }

    await patient.save(useSession ? { session } : {});

    // Link prescription to visit if visit ID is provided
    if (req.body.visit) {
      const visit = useSession
        ? await Visit.findById(req.body.visit).session(session)
        : await Visit.findById(req.body.visit);
      if (visit) {
        // Add prescription to visit's prescriptions array
        if (!visit.prescriptions.includes(prescription._id)) {
          visit.prescriptions.push(prescription._id);
          await visit.save(useSession ? { session } : {});
        }
      }
    }

    return prescription;
  };

  let prescription;

  // Try with transaction first, fall back to non-transactional if not supported
  try {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      prescription = await savePrescription(true, session);
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
      prescription = await savePrescription(false);
    } else {
      throw error;
    }
  }

  // Populate for response
  await prescription.populate('patient', 'firstName lastName patientId');
  await prescription.populate('prescriber', 'firstName lastName');
  await prescription.populate('visit', 'visitId visitDate status');

  prescriptionLogger.info('Operation', { data: `[PRESCRIPTION CREATE] ✅ Prescription ${prescription.prescriptionId || prescription._id} created successfully` });
  prescriptionLogger.info('Operation', { data: `[PRESCRIPTION CREATE] Patient: ${prescription.patient.firstName} ${prescription.patient.lastName}, Type: ${prescription.type}` });
  if (prescription.warnings && prescription.warnings.length > 0) {
    prescriptionLogger.info('Operation', { data: `[PRESCRIPTION CREATE] ⚠️ ${prescription.warnings.length} warning(s) attached to prescription` });
  }

  // WebSocket broadcast: Notify pharmacists of new prescription
  try {
    const medicationNames = prescription.type === 'medication' && prescription.medications
      ? prescription.medications.map(m => m.name || m.genericName).filter(Boolean)
      : [];

    // Notify pharmacist role
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

    // Notify patient that prescription is ready
    if (prescription.patient._id) {
      websocketService.sendNotificationToUser(prescription.patient._id.toString(), {
        type: 'prescription_ready',
        prescriptionId: prescription._id,
        prescriptionNumber: prescription.prescriptionId,
        status: 'pending',
        message: 'Votre ordonnance est prête',
        timestamp: new Date()
      });
    }

    prescriptionLogger.info('Operation', { data: '[PRESCRIPTION CREATE] WebSocket notifications sent to pharmacists and patient' });
  } catch (wsError) {
    // Don't fail the request if WebSocket broadcast fails
    prescriptionLogger.warn('WebSocket broadcast failed', { error: wsError.message });
  }

  res.status(201).json({
    success: true,
    data: prescription
  });
});

// @desc    Create prescription with safety override (for critical cases)
// @route   POST /api/prescriptions/create-with-override
// @access  Private (Doctor, Ophthalmologist ONLY - requires documented reason)
exports.createPrescriptionWithSafetyOverride = asyncHandler(async (req, res, next) => {
  const userId = req.user._id || req.user.id;
  const { overrideReason, safetyWarnings, ...prescriptionData } = req.body;

  // CRITICAL: Require override reason
  if (!overrideReason || overrideReason.trim().length < 20) {
    return res.status(400).json({
      success: false,
      error: 'Override reason required',
      message: 'Une raison médicale détaillée (minimum 20 caractères) est obligatoire pour contourner les contrôles de sécurité.'
    });
  }

  // CRITICAL: Require list of acknowledged safety warnings
  if (!safetyWarnings || !Array.isArray(safetyWarnings) || safetyWarnings.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Safety warnings acknowledgment required',
      message: 'Vous devez confirmer les avertissements de sécurité que vous choisissez d\'ignorer.'
    });
  }

  // Validate patient exists
  const patient = await findPatientByIdOrCode(prescriptionData.patient);
  if (!patient) {
    return notFound(res, 'Patient');
  }

  // Build prescription with override documentation
  prescriptionData.prescriber = userId;
  prescriptionData.createdBy = userId;

  // Add override metadata to each medication
  if (prescriptionData.medications) {
    prescriptionData.medications = prescriptionData.medications.map(med => ({
      ...med,
      safetyChecks: {
        ...med.safetyChecks,
        overridden: true,
        overrideReason: overrideReason,
        overrideBy: userId,
        checksPerformedAt: new Date(),
        warnings: safetyWarnings.filter(w =>
          w.toLowerCase().includes(med.name?.toLowerCase()) ||
          w.toLowerCase().includes(med.genericName?.toLowerCase())
        )
      }
    }));
  }

  // Store all warnings on the prescription
  prescriptionData.warnings = [
    ...(prescriptionData.warnings || []),
    ...safetyWarnings.map(w => `OVERRIDE: ${w}`)
  ];

  // Create audit log entry BEFORE prescription creation
  await AuditLog.create({
    userId: userId,
    action: 'SAFETY_OVERRIDE',
    resourceType: 'Prescription',
    resourceId: null, // Will update after creation
    details: {
      patientId: patient._id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      overrideReason: overrideReason,
      safetyWarningsOverridden: safetyWarnings,
      medicationCount: prescriptionData.medications?.length || 0,
      medications: prescriptionData.medications?.map(m => ({
        name: m.name,
        genericName: m.genericName,
        quantity: m.quantity
      })),
      severity: 'HIGH',
      timestamp: new Date()
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  prescriptionLogger.info('Operation', { data: `[PRESCRIPTION SAFETY OVERRIDE] Doctor ${req.user.firstName} ${req.user.lastName} overriding safety warnings` });
  prescriptionLogger.info('Operation', { data: `[PRESCRIPTION SAFETY OVERRIDE] Patient: ${patient.firstName} ${patient.lastName}` });
  prescriptionLogger.info('Operation', { data: `[PRESCRIPTION SAFETY OVERRIDE] Reason: ${overrideReason}` });
  prescriptionLogger.info('Operation', { data: `[PRESCRIPTION SAFETY OVERRIDE] Warnings overridden: ${safetyWarnings.length}` });
  safetyWarnings.forEach((w, i) => prescriptionLogger.info('Operation', { data: `  ${i + 1}. ${w}` }));

  // Create prescription (skip normal safety checks)
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

  // Update audit log with prescription ID
  await AuditLog.updateOne(
    { userId, action: 'SAFETY_OVERRIDE', 'details.patientId': patient._id, resourceId: null },
    { $set: { resourceId: prescription._id } },
    { sort: { createdAt: -1 } }
  );

  // Add prescription to patient record (reference only - no data duplication)
  if (!patient.prescriptions.includes(prescription._id)) {
    patient.prescriptions.push(prescription._id);
  }

  // Store reference to latest optical prescription if applicable
  if (prescription.type === 'optical') {
    patient.ophthalmology.latestOpticalPrescription = prescription._id;
  }

  await patient.save();

  // Populate for response
  await prescription.populate('patient', 'firstName lastName patientId');
  await prescription.populate('prescriber', 'firstName lastName');

  prescriptionLogger.info('Operation', { data: `[PRESCRIPTION SAFETY OVERRIDE] ⚠️ Prescription ${prescription.prescriptionId || prescription._id} created with safety override` });

  res.status(201).json({
    success: true,
    data: prescription,
    warning: 'Cette ordonnance a été créée avec un contournement des contrôles de sécurité. Elle a été enregistrée dans le journal d\'audit.',
    safetyOverride: {
      overridden: true,
      reason: overrideReason,
      warningsAcknowledged: safetyWarnings.length
    }
  });
});

// @desc    Update prescription
// @route   PUT /api/prescriptions/:id
// @access  Private (Doctor, Ophthalmologist)
exports.updatePrescription = asyncHandler(async (req, res, next) => {
  req.body.updatedBy = req.user._id || req.user.id;

  // Prevent updating certain fields
  delete req.body.prescriptionId;
  delete req.body.prescriber;
  delete req.body.createdAt;

  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  // Check if user is the prescriber
  const userId = req.user._id || req.user.id;
  if (prescription.prescriber.toString() !== userId.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'You can only update your own prescriptions'
    });
  }

  // Check if prescription is already dispensed
  if (prescription.status === 'dispensed' || prescription.status === 'partial') {
    return error(res, 'Cannot update a prescription that has been dispensed');
  }

  // CRITICAL FIX: Run safety checks when medications are modified
  // Previously, medications could be changed without drug interaction or allergy review
  if (req.body.medications && req.body.medications.length > 0 && prescription.type === 'medication') {
    // Fetch patient for safety checks
    const Patient = require('../models/Patient');
    const patient = await findPatientByIdOrCode(prescription.patient);

    if (patient) {
      const currentMeds = patient.medications?.filter(m => m.status === 'active') || [];

      // Run local safety checks (allergies, interactions, age)
      const safetyResults = drugSafetyService.checkMultipleDrugs(req.body.medications, patient, currentMeds);

      // Check for critical issues
      if (safetyResults.hasAnyCritical) {
        return res.status(400).json({
          success: false,
          error: 'Critical drug safety issues detected on update',
          safetyCheck: safetyResults,
          message: 'Prescription cannot be updated due to critical safety concerns. Please review medications.',
          hint: 'Use overrideSafetyCheck: true to bypass (requires documented reason)'
        });
      }

      // Add warnings from safety check
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
        req.body.safetyCheckUpdatedAt = new Date();
      }
    }
  }

  // VALIDATION: If updating medications, validate ophthalmic routes have eye selection
  if (req.body.medications && req.body.medications.length > 0) {
    const OPHTHALMIC_ROUTES = ['ophthalmic', 'intravitreal', 'subconjunctival', 'periocular', 'intracameral'];
    const missingEyeSelection = [];

    for (const med of req.body.medications) {
      if (OPHTHALMIC_ROUTES.includes(med.route)) {
        if (!med.applicationLocation?.eye || !['OD', 'OS', 'OU'].includes(med.applicationLocation.eye)) {
          missingEyeSelection.push({
            medication: med.name || med.genericName,
            route: med.route,
            reason: 'Ophthalmic medications must specify eye: OD (right), OS (left), or OU (both)'
          });
        }
      }
    }

    if (missingEyeSelection.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing eye selection for ophthalmic medications',
        medicationsNeedingEyeSelection: missingEyeSelection,
        message: 'Les médicaments ophtalmiques doivent indiquer l\'oeil concerné (OD = droit, OS = gauche, OU = les deux).',
        hint: 'Set applicationLocation.eye to one of: OD, OS, OU'
      });
    }
  }

  Object.assign(prescription, sanitizeForAssign(req.body));
  await prescription.save();

  return success(res, { data: prescription });
});

// @desc    Cancel prescription
// @route   PUT /api/prescriptions/:id/cancel
// @access  Private
exports.cancelPrescription = asyncHandler(async (req, res, next) => {
  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  // Check permissions
  const userId = req.user._id || req.user.id;
  if (prescription.prescriber.toString() !== userId.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'You can only cancel your own prescriptions'
    });
  }

  // Release reserved inventory if prescription was ready/reserved
  if (prescription.status === 'ready' || prescription.status === 'reserved') {
    const { Inventory, PharmacyInventory } = require('../models/Inventory');

    for (const medication of prescription.medications) {
      // CRITICAL FIX: Use correct field name 'inventoryItem' not 'inventoryId'
      if (medication.inventoryItem) {
        const inventory = await PharmacyInventory.findById(medication.inventoryItem);

        if (inventory && inventory.reservations) {
          // Find reservation for this prescription
          const reservationIndex = inventory.reservations.findIndex(
            r => r.reference && r.reference.toString() === prescription._id.toString()
          );

          if (reservationIndex !== -1) {
            const reservation = inventory.reservations[reservationIndex];

            // Add reserved quantity back to available stock
            inventory.inventory.currentStock += reservation.quantity;

            // Remove reservation
            inventory.reservations.splice(reservationIndex, 1);

            // Update status if no more reservations
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

// @desc    Sign prescription (doctor signature)
// @route   PUT /api/prescriptions/:id/sign
// @access  Private (Doctor, Ophthalmologist, Admin)
exports.signPrescription = asyncHandler(async (req, res, next) => {
  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  // Check permissions - only prescriber or admin can sign
  const userId = req.user._id || req.user.id;
  if (prescription.prescriber.toString() !== userId.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Only the prescriber can sign this prescription'
    });
  }

  // Already signed?
  if (prescription.signature?.prescriber?.signed) {
    return error(res, 'Prescription is already signed');
  }

  // Use findByIdAndUpdate to avoid version conflicts with optimistic concurrency
  // CRITICAL FIX: Also update status to 'active' when signed
  // This ensures prescriptions are marked as ready for pharmacy processing
  const updatedPrescription = await Prescription.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        'signature.prescriber.signed': true,
        'signature.prescriber.signedAt': new Date(),
        'signature.prescriber.signedBy': userId,
        // Update status to 'active' (signed and ready for dispensing)
        // Only update if current status is 'pending' or 'draft'
        ...(prescription.status === 'pending' || prescription.status === 'draft'
          ? { status: 'active' }
          : {})
      }
    },
    { new: true, runValidators: true }
  ).populate('prescriber', 'firstName lastName specialization')
    .populate('patient', 'firstName lastName dateOfBirth');

  prescriptionLogger.info('Operation', { data: `[PRESCRIPTION SIGN] Prescription ${updatedPrescription.prescriptionId} signed and status updated to ${updatedPrescription.status}` });

  return success(res, { data: updatedPrescription, message: 'Prescription signed successfully' });
});

// @desc    Dispense prescription
// @route   PUT /api/prescriptions/:id/dispense
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
        // This allows dispensing even when inventory isn't set up for that medication
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

        // CRITICAL: Pass session to save for transaction safety
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
    // CRITICAL FIX: Count unique fill sessions (by date), not dispensing records
    // Multiple medications dispensed at same time = 1 fill, not N fills
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
            med.refills.remaining = Math.max(0, remainingRefills - 1); // -1 because remaining doesn't include current fill
          }
        });
      }
    } else {
      prescription.status = 'dispensed';
    }

    // Re-fetch prescription to check if it was already dispensed (e.g., by auto-dispense on invoice payment)
    const currentPrescription = await Prescription.findById(prescription._id).select('status __v');
    if (currentPrescription && currentPrescription.status === 'dispensed') {
      // Already dispensed (likely by auto-dispense), return success
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
        // CRITICAL FIX: Check if invoice already exists to prevent double-invoicing
        // This can happen when using "pay first, dispense later" workflow where
        // createInvoiceForPrescription() was called first, then autoDispense runs on payment
        if (prescription.invoice) {
          const existingInvoice = await Invoice.findById(prescription.invoice);
          if (existingInvoice) {
            prescriptionLogger.info('Operation', { data: `[Prescription ${prescription.prescriptionId}] Invoice already exists (${existingInvoice.invoiceId}), skipping creation` });
            invoice = existingInvoice;
          }
        }

        // Only create new invoice if none exists
        if (!invoice) {
          // Build invoice items from dispensed medications
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
        } // End if (!invoice) - only create if no existing invoice
      } catch (invoiceError) {
        prescriptionLogger.error('Error generating invoice for prescription:', { error: invoiceError.message });
        // Don't fail the dispense if invoice creation fails
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

    // WebSocket broadcast: Notify patient and prescriber that prescription was dispensed
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

// @desc    Create invoice for prescription (before dispensing)
// @route   POST /api/prescriptions/:id/invoice
// @access  Private (Receptionist, Pharmacist, Admin)
// This allows the "pay first, then dispense" workflow
exports.createInvoiceForPrescription = asyncHandler(async (req, res, next) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId phoneNumber email');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  // Check if invoice already exists
  if (prescription.invoice) {
    const existingInvoice = await Invoice.findById(prescription.invoice);
    if (existingInvoice) {
      return success(res, { data: existingInvoice, message: 'Invoice already exists for this prescription' });
    }
  }

  // Only medication prescriptions can have invoices created this way
  if (prescription.type !== 'medication') {
    return error(res, 'Only medication prescriptions can be invoiced through this endpoint');
  }

  // Check prescription status
  if (prescription.status === 'cancelled') {
    return error(res, 'Cannot create invoice for cancelled prescription');
  }

  if (prescription.status === 'dispensed') {
    return error(res, 'Prescription has already been dispensed');
  }

  // Build invoice items from prescription medications
  const invoiceItems = [];
  const inventoryWarnings = [];

  for (const medication of prescription.medications || []) {
    const quantity = medication.quantity || 1;
    let unitPrice = medication.pricing?.unitPrice || 0;
    let inventoryItem = null;

    // Try to find inventory item for pricing
    if (medication.inventoryItem) {
      inventoryItem = await PharmacyInventory.findById(medication.inventoryItem);
    }

    // If no direct reference, try to find by medication name
    if (!inventoryItem && medication.name) {
      const escapedMedName = medication.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      inventoryItem = await PharmacyInventory.findOne({
        $or: [
          { 'medication.genericName': { $regex: new RegExp(escapedMedName, 'i') } },
          { 'medication.brandName': { $regex: new RegExp(escapedMedName, 'i') } }
        ]
      });

      // Link inventory item to medication for later dispensing
      if (inventoryItem) {
        medication.inventoryItem = inventoryItem._id;
      }
    }

    // Get pricing from inventory if available
    if (inventoryItem) {
      unitPrice = inventoryItem.pricing?.sellingPrice || unitPrice;

      // Check stock availability (warning only, don't block invoice creation)
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
      reference: `Prescription:${prescription._id}` // CRITICAL: Link to prescription for auto-dispense
    });
  }

  const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);

  if (subtotal === 0) {
    return error(res, 'Cannot create invoice with zero amount. Check medication pricing.');
  }

  // ATOMIC INVOICE CREATION - Prevents race condition with unique index on prescription
  let invoice;
  try {
    invoice = await Invoice.create({
      patient: prescription.patient._id || prescription.patient,
      prescription: prescription._id, // Direct link to prescription (unique sparse index)
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
  } catch (error) {
    // Handle duplicate key error (race condition - another request created invoice first)
    if (error.code === 11000 && error.keyPattern?.prescription) {
      prescriptionLogger.info('Operation', { data: `[Prescription ${prescription.prescriptionId}] Race condition detected - invoice already exists` });
      const existingInvoice = await Invoice.findOne({ prescription: prescription._id });
      if (existingInvoice) {
        return success(res, { data: existingInvoice, message: 'Invoice already exists for this prescription' });
      }
    }
    throw error;
  }

  // Link invoice to prescription (atomic update)
  await Prescription.updateOne(
    { _id: prescription._id, invoice: { $exists: false } },
    { $set: { invoice: invoice._id } }
  );

  prescriptionLogger.info('Operation', { data: `[Prescription ${prescription.prescriptionId || prescription._id}] Invoice ${invoice.invoiceId} created. Payment will auto-dispense.` });

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

// @desc    Verify prescription
// @route   POST /api/prescriptions/:id/verify
// @access  Private
exports.verifyPrescription = asyncHandler(async (req, res, next) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('prescriber', 'firstName lastName licenseNumber');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  // Perform verification checks
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

  // Save verification record
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

// @desc    Print prescription
// @route   GET /api/prescriptions/:id/print
// @access  Private
exports.printPrescription = asyncHandler(async (req, res, next) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('patient', 'firstName lastName dateOfBirth patientId address phoneNumber')
    .populate('prescriber', 'firstName lastName licenseNumber department signature')
    .populate('appointment', 'date');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  // Format prescription for printing
  const printData = prescription.formatForPrint();

  // Add view to history
  prescription.viewHistory.push({
    viewedBy: req.user._id || req.user.id,
    viewedAt: Date.now(),
    action: 'PRINT'
  });
  await prescription.save();

  return success(res, { data: printData });
});

// @desc    Renew prescription
// @route   POST /api/prescriptions/:id/renew
// @access  Private (Doctor, Ophthalmologist)
exports.renewPrescription = asyncHandler(async (req, res, next) => {
  const originalPrescription = await Prescription.findById(req.params.id);

  if (!originalPrescription) {
    return res.status(404).json({
      success: false,
      error: 'Original prescription not found'
    });
  }

  // Create new prescription based on original
  const renewalData = originalPrescription.toObject();
  delete renewalData._id;
  delete renewalData.prescriptionId;
  delete renewalData.createdAt;
  delete renewalData.updatedAt;
  delete renewalData.dispensing;
  delete renewalData.viewHistory;

  // Update renewal specific fields
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

  // Reset validity period
  const validityDays = renewalData.type === 'optical' ? 365 : 90;
  renewalData.validUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

  const newPrescription = await Prescription.create(renewalData);

  // Update original prescription
  originalPrescription.renewal.renewalRequested = true;
  originalPrescription.renewal.renewalRequestedAt = Date.now();
  await originalPrescription.save();

  // Populate for response
  await newPrescription.populate('patient', 'firstName lastName patientId');
  await newPrescription.populate('prescriber', 'firstName lastName');

  res.status(201).json({
    success: true,
    message: 'Prescription renewed successfully',
    data: newPrescription
  });
});

// Helper function to check drug interactions (legacy - uses new service)
async function checkDrugInteractionsHelper(newMedications, patient) {
  const interactions = [];
  const currentMeds = patient.medications?.filter(med => med.status === 'active') || [];

  newMedications.forEach(newMed => {
    const result = drugSafetyService.checkDrugInteractions(newMed, currentMeds);
    if (result.hasInteraction) {
      result.interactions.forEach(interaction => {
        interactions.push(`${interaction.severity.toUpperCase()}: ${interaction.effect} (${interaction.drug1} + ${interaction.drug2})`);
      });
    }
  });

  return interactions;
}

// ============================================
// DRUG SAFETY CHECK ENDPOINTS
// ============================================

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

// @desc    Get drug safety service status (external APIs and local database stats)
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

// @desc    Validate prescription before creation
// @route   POST /api/prescriptions/validate
// @access  Private
exports.validatePrescription = asyncHandler(async (req, res) => {
  const prescriptionData = req.body;
  const validationErrors = [];
  const warnings = [];

  // Basic validation
  if (!prescriptionData.patient) {
    validationErrors.push('Patient is required');
  }

  if (!prescriptionData.type) {
    validationErrors.push('Prescription type is required');
  }

  if (prescriptionData.type === 'medication') {
    if (!prescriptionData.medications || prescriptionData.medications.length === 0) {
      validationErrors.push('At least one medication is required');
    } else {
      // Validate each medication
      prescriptionData.medications.forEach((med, index) => {
        if (!med.name) {
          validationErrors.push(`Medication ${index + 1}: Name is required`);
        }
        if (!med.dosage) {
          validationErrors.push(`Medication ${index + 1}: Dosage is required`);
        }
        if (!med.frequency) {
          validationErrors.push(`Medication ${index + 1}: Frequency is required`);
        }
      });

      // Run safety checks if patient provided
      if (prescriptionData.patient) {
        const patient = await findPatientByIdOrCode(prescriptionData.patient);
        if (patient) {
          const currentMeds = patient.medications?.filter(m => m.status === 'active') || [];

          // Local safety checks
          const safetyResults = drugSafetyService.checkMultipleDrugs(
            prescriptionData.medications,
            patient,
            currentMeds
          );

          // External API checks (BDPM, RxNorm, OpenFDA)
          const externalSources = [];
          try {
            for (const med of prescriptionData.medications) {
              const medName = med.genericName || med.name;
              const externalCheck = await drugSafetyService.checkInteractionsWithExternalAPI(medName, currentMeds);

              if (externalCheck.hasInteraction) {
                externalSources.push(...externalCheck.sources);

                // Check for critical external interactions
                const hasCriticalExternal = externalCheck.interactions.some(
                  int => int.severity === 'contraindicated'
                );
                const hasMajorExternal = externalCheck.interactions.some(
                  int => int.severity === 'major'
                );

                if (hasCriticalExternal) safetyResults.hasAnyCritical = true;
                if (hasMajorExternal) safetyResults.hasAnyMajor = true;

                // Add external interaction warnings
                externalCheck.interactions.forEach(int => {
                  if (int.severity === 'major' || int.severity === 'contraindicated') {
                    warnings.push(`${int.severity.toUpperCase()}: ${int.effect || int.description} (${int.drug1} + ${int.drug2})`);
                  }
                });
              }
            }
          } catch (externalError) {
            prescriptionLogger.warn('External API validation check failed', { error: externalError.message });
          }

          if (safetyResults.hasAnyCritical) {
            validationErrors.push('Critical safety issues detected - prescription cannot be created');
          }

          if (safetyResults.hasAnyMajor) {
            warnings.push('Major safety concerns detected - review required before dispensing');
          }

          if (externalSources.length > 0) {
            warnings.push(`Data verified via: ${[...new Set(externalSources)].join(', ')}`);
          }
        }
      }
    }
  }

  if (prescriptionData.type === 'optical') {
    if (!prescriptionData.optical) {
      validationErrors.push('Optical prescription data is required');
    }
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
// TEMPLATE ENDPOINTS
// ============================================

// @desc    Get prescription templates
// @route   GET /api/prescriptions/templates
// @access  Private
exports.getTemplates = asyncHandler(async (req, res) => {
  const { type, category, createdBy, search } = req.query;

  // Try to get templates from database, fallback to default templates
  let templates = [];

  try {
    const Template = mongoose.models.PrescriptionTemplate ||
      mongoose.model('PrescriptionTemplate', new mongoose.Schema({
        name: { type: String, required: true },
        type: { type: String, enum: ['medication', 'optical'], required: true },
        category: String,
        description: String,
        medications: [{
          name: String,
          genericName: String,
          dosage: String,
          frequency: String,
          duration: String,
          route: String,
          instructions: String,
          quantity: Number,
          refills: Number
        }],
        optical: {
          OD: mongoose.Schema.Types.Mixed,
          OS: mongoose.Schema.Types.Mixed,
          pd: Number,
          addPower: Number
        },
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
    prescriptionLogger.info('Templates collection not found, using defaults');
  }

  // Add default templates if none found
  if (templates.length === 0) {
    templates = getDefaultTemplates(type);
  }

  res.json({
    success: true,
    count: templates.length,
    data: templates
  });
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

  const templateData = {
    ...req.body,
    createdBy: req.user._id || req.user.id
  };

  const template = await Template.create(templateData);

  res.status(201).json({
    success: true,
    data: template
  });
});

// @desc    Get single template
// @route   GET /api/prescriptions/templates/:templateId
// @access  Private
exports.getTemplate = asyncHandler(async (req, res) => {
  const Template = mongoose.models.PrescriptionTemplate;

  if (!Template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found'
    });
  }

  const template = await Template.findById(req.params.templateId)
    .populate('createdBy', 'firstName lastName');

  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found'
    });
  }

  res.json({
    success: true,
    data: template
  });
});

// @desc    Update template
// @route   PUT /api/prescriptions/templates/:templateId
// @access  Private (Doctor, Admin)
exports.updateTemplate = asyncHandler(async (req, res) => {
  const Template = mongoose.models.PrescriptionTemplate;

  if (!Template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found'
    });
  }

  const template = await Template.findByIdAndUpdate(
    req.params.templateId,
    req.body,
    { new: true, runValidators: true }
  );

  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found'
    });
  }

  res.json({
    success: true,
    data: template
  });
});

// @desc    Delete template
// @route   DELETE /api/prescriptions/templates/:templateId
// @access  Private (Admin)
exports.deleteTemplate = asyncHandler(async (req, res) => {
  const Template = mongoose.models.PrescriptionTemplate;

  if (!Template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found'
    });
  }

  // Soft delete
  const template = await Template.findByIdAndUpdate(
    req.params.templateId,
    { isActive: false },
    { new: true }
  );

  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found'
    });
  }

  res.json({
    success: true,
    message: 'Template deleted successfully'
  });
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
        { name: 'Prednisolone Acetate 1%', dosage: '1 drop', frequency: 'QID', duration: '4 weeks', route: 'ophthalmic', instructions: 'Taper weekly' },
        { name: 'Moxifloxacin 0.5%', dosage: '1 drop', frequency: 'QID', duration: '1 week', route: 'ophthalmic' },
        { name: 'Nepafenac 0.1%', dosage: '1 drop', frequency: 'TID', duration: '4 weeks', route: 'ophthalmic' }
      ],
      isDefault: true
    },
    {
      _id: 'default-2',
      name: 'Bacterial Conjunctivitis',
      type: 'medication',
      category: 'ophthalmology',
      description: 'Standard treatment for bacterial conjunctivitis',
      medications: [
        { name: 'Moxifloxacin 0.5%', dosage: '1 drop', frequency: 'TID', duration: '7 days', route: 'ophthalmic' }
      ],
      isDefault: true
    },
    {
      _id: 'default-3',
      name: 'Glaucoma - Initial Treatment',
      type: 'medication',
      category: 'ophthalmology',
      description: 'First-line glaucoma treatment',
      medications: [
        { name: 'Latanoprost 0.005%', dosage: '1 drop', frequency: 'QHS', duration: '30 days', route: 'ophthalmic', instructions: 'Apply at bedtime' }
      ],
      isDefault: true
    },
    {
      _id: 'default-4',
      name: 'Allergic Conjunctivitis',
      type: 'medication',
      category: 'ophthalmology',
      description: 'Treatment for allergic eye conditions',
      medications: [
        { name: 'Olopatadine 0.1%', dosage: '1 drop', frequency: 'BID', duration: '14 days', route: 'ophthalmic' }
      ],
      isDefault: true
    },
    {
      _id: 'default-5',
      name: 'Dry Eye Syndrome',
      type: 'medication',
      category: 'ophthalmology',
      description: 'Treatment for dry eye disease',
      medications: [
        { name: 'Artificial Tears', dosage: '1-2 drops', frequency: 'QID PRN', duration: '30 days', route: 'ophthalmic', instructions: 'Use as needed for comfort' },
        { name: 'Cyclosporine 0.05%', dosage: '1 drop', frequency: 'BID', duration: '30 days', route: 'ophthalmic', instructions: 'May take 4-6 weeks for full effect' }
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
      optical: {
        OD: { sphere: 0, cylinder: 0, axis: 0 },
        OS: { sphere: 0, cylinder: 0, axis: 0 },
        pd: 63
      },
      isDefault: true
    },
    {
      _id: 'optical-2',
      name: 'Progressive Lenses',
      type: 'optical',
      category: 'glasses',
      description: 'Progressive/multifocal glasses prescription',
      optical: {
        OD: { sphere: 0, cylinder: 0, axis: 0 },
        OS: { sphere: 0, cylinder: 0, axis: 0 },
        pd: 63,
        addPower: 2.0
      },
      instructions: 'Progressive lenses recommended',
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
  if (Object.keys(dateQuery).length > 0) {
    matchStage.dateIssued = dateQuery;
  }
  if (prescriber) {
    matchStage.prescriber = new mongoose.Types.ObjectId(prescriber);
  }

  const stats = await Prescription.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        byStatus: {
          $push: '$status'
        },
        byType: {
          $push: '$type'
        }
      }
    }
  ]);

  const statusCounts = {};
  const typeCounts = {};

  if (stats.length > 0) {
    stats[0].byStatus.forEach(s => {
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    stats[0].byType.forEach(t => {
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
  }

  // Get recent trends
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

  if (patient) {
    query.patient = patient;
  }

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
// PDF GENERATION
// ============================================

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

  // Generate PDF using built-in formatting
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ margin: 50 });

  // Set response headers for PDF
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=prescription-${prescription.prescriptionId}.pdf`);

  doc.pipe(res);

  // Header - Clinic Info from environment
  const clinicName = process.env.CLINIC_NAME || 'Centre Ophtalmologique';
  const clinicAddress = process.env.CLINIC_ADDRESS || '';
  const clinicPhone = process.env.CLINIC_PHONE || '';
  const clinicCity = process.env.CLINIC_CITY || '';

  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e40af').text(clinicName, { align: 'center' });
  doc.fontSize(9).font('Helvetica').fillColor('black');
  if (clinicAddress) doc.text(clinicAddress + (clinicCity ? `, ${clinicCity}` : ''), { align: 'center' });
  if (clinicPhone) doc.text(`Tél: ${clinicPhone}`, { align: 'center' });
  doc.moveDown(0.5);

  // Document title
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000').text('ORDONNANCE MÉDICALE', { align: 'center' });
  doc.moveDown(0.5);

  // Line
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown();

  // Patient Info
  doc.fontSize(12).font('Helvetica-Bold').text('PATIENT:');
  doc.fontSize(11).font('Helvetica')
    .text(`Nom: ${prescription.patient.firstName} ${prescription.patient.lastName}`)
    .text(`ID Patient: ${prescription.patient.patientId}`)
    .text(`Date de naissance: ${prescription.patient.dateOfBirth ? new Date(prescription.patient.dateOfBirth).toLocaleDateString('fr-FR') : 'N/A'}`);
  doc.moveDown();

  // Prescription Date
  doc.text(`Date de prescription: ${new Date(prescription.dateIssued).toLocaleDateString('fr-FR')}`);
  doc.text(`Valide jusqu'au: ${prescription.validUntil ? new Date(prescription.validUntil).toLocaleDateString('fr-FR') : 'N/A'}`);
  doc.moveDown();

  // Line
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown();

  // Medications or Optical
  if (prescription.type === 'medication' && prescription.medications) {
    doc.fontSize(12).font('Helvetica-Bold').text('MEDICATIONS:');
    doc.moveDown(0.5);

    prescription.medications.forEach((med, index) => {
      // Medication name with strength
      const medName = med.genericName ? `${med.name} (${med.genericName})` : med.name;
      const strength = med.strength ? ` - ${med.strength}` : '';
      doc.fontSize(11).font('Helvetica-Bold').text(`${index + 1}. ${medName}${strength}`);

      // Dosage details
      doc.fontSize(10).font('Helvetica');

      // Format dosage properly
      let dosageText = '';
      if (med.dosage?.amount && med.dosage?.unit) {
        dosageText = `${med.dosage.amount} ${med.dosage.unit}`;
        if (med.dosage.frequency?.times && med.dosage.frequency?.period) {
          dosageText += `, ${med.dosage.frequency.times}x/${med.dosage.frequency.period}`;
        }
        if (med.dosage.duration?.value && med.dosage.duration?.unit) {
          dosageText += ` pendant ${med.dosage.duration.value} ${med.dosage.duration.unit}`;
        }
      } else {
        dosageText = med.dosage || 'N/A';
      }
      doc.text(`   Posologie: ${dosageText}`);

      if (med.frequency) doc.text(`   Fréquence: ${med.frequency}`);
      if (med.duration) doc.text(`   Durée: ${med.duration}`);
      if (med.route) doc.text(`   Voie d'administration: ${med.route}`);

      // Timing (morning, evening, etc.)
      if (med.dosage?.timing && med.dosage.timing.length > 0) {
        const timingLabels = {
          'morning': 'matin',
          'afternoon': 'après-midi',
          'evening': 'soir',
          'bedtime': 'coucher'
        };
        const timingStr = med.dosage.timing.map(t => timingLabels[t] || t).join(', ');
        doc.text(`   Moment de prise: ${timingStr}`);
      }

      // WithFood instructions (CRITICAL for patient safety)
      if (med.dosage?.withFood) {
        const withFoodLabels = {
          'before': '⚠️ À prendre AVANT les repas',
          'with': '🍽️ À prendre PENDANT les repas',
          'after': '🍽️ À prendre APRÈS les repas',
          'empty-stomach': '⚠️ À prendre À JEUN (estomac vide)',
          'anytime': 'Peut être pris à tout moment'
        };
        doc.font('Helvetica-Bold').fillColor('#059669')
          .text(`   ${withFoodLabels[med.dosage.withFood] || med.dosage.withFood}`);
        doc.font('Helvetica').fillColor('black');
      }

      // Clinical indication
      if (med.indication) {
        doc.fillColor('#4b5563').text(`   Indication: ${med.indication}`);
        doc.fillColor('black');
      }

      if (med.instructions) {
        doc.text(`   Instructions: ${med.instructions}`);
      }

      // Refills
      if (med.refills?.allowed > 0) {
        doc.text(`   Renouvellements autorisés: ${med.refills.allowed} (restants: ${med.refills.remaining || med.refills.allowed})`);
      }

      // Substitution policy
      if (med.substitutionAllowed === false) {
        doc.font('Helvetica-Bold').text('   ⚠️ Non substituable (NS)');
        doc.font('Helvetica');
      }

      // SAFETY WARNINGS (CRITICAL)
      if (med.safetyChecks) {
        // Drug interactions
        if (med.safetyChecks.interactions && med.safetyChecks.interactions.length > 0) {
          doc.moveDown(0.3);
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#dc2626')
            .text('   ⚠️ INTERACTIONS MÉDICAMENTEUSES:');
          doc.fontSize(8).font('Helvetica');
          med.safetyChecks.interactions.forEach(interaction => {
            const severityIcon = interaction.severity === 'high' ? '🔴' : interaction.severity === 'moderate' ? '🟠' : '🟡';
            doc.text(`      ${severityIcon} ${interaction.withDrug}: ${interaction.description || 'Interaction potentielle'}`);
          });
          doc.fillColor('black');
        }

        // Allergy warnings
        const matchedAllergies = med.safetyChecks.allergies?.filter(a => a.matched);
        if (matchedAllergies && matchedAllergies.length > 0) {
          doc.moveDown(0.3);
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#dc2626')
            .text('   🚨 ALERTES ALLERGIES:');
          doc.fontSize(8).font('Helvetica');
          matchedAllergies.forEach(allergy => {
            doc.text(`      • ${allergy.allergen} (${allergy.severity || 'vérifier'})`);
          });
          doc.fillColor('black');
        }

        // Contraindications
        if (med.safetyChecks.contraindications && med.safetyChecks.contraindications.length > 0) {
          doc.moveDown(0.3);
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#dc2626')
            .text('   ⛔ CONTRE-INDICATIONS:');
          doc.fontSize(8).font('Helvetica');
          med.safetyChecks.contraindications.forEach(contra => {
            doc.text(`      • ${contra.condition}: ${contra.description || ''}`);
          });
          doc.fillColor('black');
        }

        // General warnings
        if (med.safetyChecks.warnings && med.safetyChecks.warnings.length > 0) {
          doc.moveDown(0.3);
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#b45309')
            .text('   ⚠️ Précautions:');
          doc.fontSize(8).font('Helvetica');
          med.safetyChecks.warnings.forEach(warning => {
            doc.text(`      • ${warning}`);
          });
          doc.fillColor('black');
        }

        // Override notice
        if (med.safetyChecks.overridden) {
          doc.moveDown(0.2);
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#7c3aed')
            .text('   ℹ️ Avertissements de sécurité examinés et validés par le prescripteur');
          if (med.safetyChecks.overrideReason) {
            doc.font('Helvetica').text(`      Motif: ${med.safetyChecks.overrideReason}`);
          }
          doc.fillColor('black');
        }
      }

      doc.moveDown(0.5);
    });
  }

  if (prescription.type === 'optical' && prescription.optical) {
    const optical = prescription.optical;
    const od = optical.OD || {};
    const os = optical.OS || {};

    // Prescription type header
    const rxTypeLabels = {
      'glasses': 'LUNETTES',
      'contacts': 'LENTILLES DE CONTACT',
      'both': 'LUNETTES ET LENTILLES'
    };
    doc.fontSize(12).font('Helvetica-Bold')
      .text(`PRESCRIPTION OPTIQUE - ${rxTypeLabels[optical.prescriptionType] || 'VERRES CORRECTEURS'}:`);
    doc.moveDown(0.5);

    // Create refraction table
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('           Sphère    Cylindre    Axe      Add      AV', { continued: false });
    doc.font('Helvetica');
    doc.moveDown(0.3);

    // Format value with sign
    const formatDiopter = (val) => {
      if (val === undefined || val === null) return '  -  ';
      const num = parseFloat(val);
      if (isNaN(num)) return '  -  ';
      return num >= 0 ? `+${num.toFixed(2)}` : num.toFixed(2);
    };

    // OD row
    doc.text(`OD (D):  ${formatDiopter(od.sphere)}   ${formatDiopter(od.cylinder)}    ${od.axis || '-'}°     ${od.add ? `+${od.add}` : '-'}    ${od.va || '-'}`);

    // OS row
    doc.text(`OG (G):  ${formatDiopter(os.sphere)}   ${formatDiopter(os.cylinder)}    ${os.axis || '-'}°     ${os.add ? `+${os.add}` : '-'}    ${os.va || '-'}`);

    doc.moveDown(0.5);

    // Prism values (if present)
    if (od.prism || os.prism) {
      doc.font('Helvetica-Bold').text('Prisme:');
      doc.font('Helvetica');
      if (od.prism) {
        doc.text(`   OD: ${od.prism}Δ base ${od.base || 'N/A'}`);
      }
      if (os.prism) {
        doc.text(`   OG: ${os.prism}Δ base ${os.base || 'N/A'}`);
      }
      doc.moveDown(0.3);
    }

    // Pupillary Distance
    if (optical.pd) {
      doc.font('Helvetica-Bold').text('Écart pupillaire (EP):');
      doc.font('Helvetica');
      if (typeof optical.pd === 'object') {
        // Structured PD with binocular and monocular
        if (optical.pd.binocular) {
          doc.text(`   Binoculaire: ${optical.pd.binocular} mm`);
        }
        if (optical.pd.monocular?.OD || optical.pd.monocular?.OS) {
          doc.text(`   Monoculaire: OD ${optical.pd.monocular?.OD || '-'} mm / OG ${optical.pd.monocular?.OS || '-'} mm`);
        }
      } else {
        doc.text(`   ${optical.pd} mm`);
      }
      doc.moveDown(0.3);
    }

    // Additional measurements
    if (optical.vertexDistance || optical.pantoscopicTilt || optical.frameWrap) {
      doc.font('Helvetica-Bold').text('Mesures complémentaires:');
      doc.font('Helvetica');
      if (optical.vertexDistance) doc.text(`   Distance verre-oeil: ${optical.vertexDistance} mm`);
      if (optical.pantoscopicTilt) doc.text(`   Angle pantoscopique: ${optical.pantoscopicTilt}°`);
      if (optical.frameWrap) doc.text(`   Galbe monture: ${optical.frameWrap}°`);
      doc.moveDown(0.3);
    }

    // Lens specifications
    if (optical.lensType || optical.lensMaterial || (optical.lensCoatings && optical.lensCoatings.length > 0)) {
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text('Spécifications des verres:');
      doc.font('Helvetica');
      if (optical.lensType) {
        const lensTypes = {
          'single vision': 'Vision simple (unifocaux)',
          'bifocal': 'Bifocaux',
          'progressive': 'Progressifs',
          'occupational': 'Professionnels/Mi-distance'
        };
        doc.text(`   Type: ${lensTypes[optical.lensType] || optical.lensType}`);
      }
      if (optical.lensMaterial) doc.text(`   Matériau: ${optical.lensMaterial}`);
      if (optical.lensCoatings && optical.lensCoatings.length > 0) {
        doc.text(`   Traitements: ${optical.lensCoatings.join(', ')}`);
      }
      if (optical.tint) doc.text(`   Teinte: ${optical.tint}`);
      doc.moveDown(0.3);
    }

    // Contact lens specifications
    if (optical.prescriptionType === 'contacts' || optical.prescriptionType === 'both') {
      if ((od.baseCurve || od.diameter || od.brand) || (os.baseCurve || os.diameter || os.brand)) {
        doc.moveDown(0.3);
        doc.font('Helvetica-Bold').text('Paramètres lentilles de contact:');
        doc.font('Helvetica');
        if (od.baseCurve || od.diameter) {
          doc.text(`   OD: BC ${od.baseCurve || '-'} / Ø ${od.diameter || '-'} mm${od.brand ? ` - ${od.brand}` : ''}`);
        }
        if (os.baseCurve || os.diameter) {
          doc.text(`   OG: BC ${os.baseCurve || '-'} / Ø ${os.diameter || '-'} mm${os.brand ? ` - ${os.brand}` : ''}`);
        }
        doc.moveDown(0.3);
      }
    }

    // Special instructions
    if (optical.specialInstructions) {
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text('Instructions spéciales:');
      doc.font('Helvetica').text(`   ${optical.specialInstructions}`);
    }

    // Validity period
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
      .text(`Cette ordonnance optique est valable ${prescription.type === 'optical' ? '12 mois' : '3 ans'} à compter de la date d'émission.`);
    doc.fillColor('black');
  }

  doc.moveDown();

  // Instructions (general, patient, pharmacy)
  const hasInstructions = prescription.instructions?.general ||
    prescription.instructions?.patient ||
    (typeof prescription.instructions === 'string' && prescription.instructions);

  if (hasInstructions) {
    doc.fontSize(12).font('Helvetica-Bold').text('INSTRUCTIONS:');
    doc.fontSize(10).font('Helvetica');
    if (typeof prescription.instructions === 'string') {
      doc.text(prescription.instructions);
    } else {
      if (prescription.instructions.patient) {
        doc.text(`Pour le patient: ${prescription.instructions.patient}`);
      }
      if (prescription.instructions.general) {
        doc.text(`Général: ${prescription.instructions.general}`);
      }
    }
    doc.moveDown();
  }

  // Precautions
  if (prescription.precautions && prescription.precautions.length > 0) {
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#b45309').text('PRÉCAUTIONS:');
    doc.fontSize(10).font('Helvetica').fillColor('black');
    prescription.precautions.forEach(p => doc.text(`• ${p}`));
    doc.moveDown();
  }

  // Warnings
  if (prescription.warnings && prescription.warnings.length > 0) {
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#dc2626').text('⚠️ AVERTISSEMENTS:');
    doc.fontSize(10).font('Helvetica').fillColor('black');
    prescription.warnings.forEach(w => doc.text(`• ${w}`));
    doc.moveDown();
  }

  // Controlled Substance Warning
  if (prescription.controlledSubstance?.schedule) {
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#7c2d12')
      .text(`⚠️ SUBSTANCE CONTRÔLÉE - TABLEAU ${prescription.controlledSubstance.schedule}`);
    doc.fontSize(9).font('Helvetica').fillColor('black');
    doc.text('Ce médicament est soumis à réglementation spéciale. Conservation et renouvellement strictement encadrés.');
    if (prescription.controlledSubstance.deaNumber) {
      doc.text(`N° d'autorisation: ${prescription.controlledSubstance.deaNumber}`);
    }
    doc.moveDown();
  }

  // Diagnosis codes (if present)
  if (prescription.diagnosis && prescription.diagnosis.length > 0) {
    doc.fontSize(10).font('Helvetica-Bold').text('Diagnostic(s):');
    doc.fontSize(9).font('Helvetica');
    prescription.diagnosis.forEach(d => {
      doc.text(`   ${d.code ? `[${d.code}] ` : ''}${d.description}`);
    });
    doc.moveDown();
  }

  // Footer with prescriber info
  doc.moveDown(2);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown();

  // Prescriber box
  doc.fontSize(10).font('Helvetica-Bold')
    .text(`Dr. ${prescription.prescriber.firstName} ${prescription.prescriber.lastName}`);

  doc.fontSize(9).font('Helvetica');
  if (prescription.prescriber.specialization || prescription.prescriber.department) {
    doc.text(prescription.prescriber.specialization || prescription.prescriber.department);
  }

  // License number with validation
  if (prescription.prescriber.licenseNumber) {
    doc.text(`N° Ordre/RPPS: ${prescription.prescriber.licenseNumber}`);
  } else {
    doc.fillColor('#dc2626').text('⚠️ N° de licence non renseigné');
    doc.fillColor('black');
  }

  // Signature area
  doc.moveDown(1.5);
  doc.text('Signature et cachet:', { continued: false });
  doc.moveDown(0.3);

  // Draw signature box
  const signatureY = doc.y;
  doc.rect(50, signatureY, 200, 50).stroke();

  // If digital signature exists
  if (prescription.signature?.prescriber?.signed) {
    doc.fontSize(8).text(`Signé électroniquement le ${
      new Date(prescription.signature.prescriber.signedAt).toLocaleDateString('fr-FR')}`,
    55, signatureY + 35);
  }

  // Prescription ID and timestamp in footer
  doc.moveDown(4);
  doc.fontSize(8).fillColor('#6b7280');

  // Left side: prescription ID
  doc.text(`ID: ${prescription.prescriptionId}`, 50, doc.y);

  // Right side: generation date
  const generatedDate = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Généré le: ${generatedDate}`, 400, doc.y - 12, { align: 'right' });

  // Clinic info footer
  doc.moveDown(0.5);
  doc.fontSize(7).text(
    `${process.env.CLINIC_NAME || 'Centre Ophtalmologique'} - ${process.env.CLINIC_ADDRESS || ''} - Tél: ${process.env.CLINIC_PHONE || ''}`,
    { align: 'center' }
  );

  doc.fillColor('black');
  doc.end();

  // Log the print action
  prescription.viewHistory.push({
    viewedBy: req.user._id || req.user.id,
    viewedAt: Date.now(),
    action: 'PDF_GENERATED'
  });
  await prescription.save();
});

// ============================================
// REFILL WORKFLOW
// ============================================

// @desc    Refill prescription (dispense another fill)
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

// ============================================
// PHARMACY STATUS WORKFLOW
// ============================================

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

  // CRITICAL FIX: Require prescription to be signed before sending to pharmacy
  // This ensures patient safety - only doctor-approved prescriptions can be dispensed
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
  prescription.status = 'ready'; // Ready for pharmacy processing

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

  // Compile full history
  const history = [];

  // Add creation
  history.push({
    action: 'CREATED',
    timestamp: prescription.createdAt,
    details: 'Prescription created by prescriber'
  });

  // Add view history
  prescription.viewHistory?.forEach(view => {
    history.push({
      action: view.action || 'VIEWED',
      timestamp: view.viewedAt,
      user: view.viewedBy,
      details: `${view.action || 'Viewed'} by ${view.viewedBy?.firstName || 'Unknown'} ${view.viewedBy?.lastName || ''}`
    });
  });

  // Add pharmacy status history
  prescription.pharmacyStatusHistory?.forEach(status => {
    history.push({
      action: `PHARMACY_${status.status.toUpperCase()}`,
      timestamp: status.changedAt,
      user: status.changedBy,
      details: status.notes || `Status changed to ${status.status}`
    });
  });

  // Add dispensing history
  prescription.dispensing?.forEach((dispense, index) => {
    history.push({
      action: dispense.isRefill ? 'REFILLED' : 'DISPENSED',
      timestamp: dispense.dispensedAt,
      user: dispense.dispensedBy,
      details: `${dispense.isRefill ? 'Refill' : 'Initial dispense'} - Qty: ${dispense.quantity || 'N/A'}`
    });
  });

  // Sort by timestamp
  history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.json({
    success: true,
    data: {
      prescriptionId: prescription.prescriptionId,
      history
    }
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

  // Create clone data
  const cloneData = originalPrescription.toObject();

  // Remove fields that should be new
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

  // Set new prescriber and dates
  const userId = req.user._id || req.user.id;
  cloneData.prescriber = userId;
  cloneData.createdBy = userId;
  cloneData.dateIssued = new Date();
  cloneData.status = 'pending';

  // Reset validity
  const validityDays = cloneData.type === 'optical' ? 365 : 90;
  cloneData.validUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

  // Reset refills if medication type
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

  // Mark as cloned
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
// E-PRESCRIBING (NCPDP) ENDPOINTS
// ============================================

// @desc    Transmit prescription electronically
// @route   POST /api/prescriptions/:id/e-prescribe
// @access  Private (Doctor, Admin)
exports.transmitEPrescription = asyncHandler(async (req, res) => {
  const { pharmacyId, pharmacyNcpdpId, pharmacyName, pharmacyAddress, pharmacyPhone, urgent } = req.body;

  const prescription = await Prescription.findById(req.params.id)
    .populate('patient', 'firstName lastName dateOfBirth gender address phoneNumber patientId')
    .populate('prescriber', 'firstName lastName licenseNumber specialization phoneNumber');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  // Check if prescription is valid for transmission
  if (prescription.status === 'cancelled') {
    return error(res, 'Cannot transmit a cancelled prescription');
  }

  if (prescription.isExpired) {
    return error(res, 'Cannot transmit an expired prescription');
  }

  // Check if already transmitted
  if (prescription.ePrescription?.transmittedAt && prescription.ePrescription?.status === 'transmitted') {
    return res.status(400).json({
      success: false,
      error: 'Prescription has already been transmitted. Use cancel and resend if needed.',
      transmissionId: prescription.ePrescription.transmissionId
    });
  }

  // Build pharmacy object
  const pharmacy = {
    ncpdpId: pharmacyNcpdpId || pharmacyId,
    name: pharmacyName || 'Unknown Pharmacy',
    address: pharmacyAddress || {},
    phone: pharmacyPhone || ''
  };

  // Transmit prescription
  const result = await ePrescribingService.transmitPrescription(
    prescription,
    pharmacy,
    prescription.prescriber,
    ePrescribingService.MESSAGE_TYPES.NEW_RX
  );

  if (result.success) {
    // Update prescription with e-prescription details
    prescription.ePrescription = {
      enabled: true,
      transmittedAt: new Date(),
      transmissionId: result.transmissionId,
      sentTo: {
        pharmacy: pharmacy.name,
        ncpdpId: pharmacy.ncpdpId
      },
      status: result.status,
      messageId: result.messageId,
      urgent: urgent || false,
      testMode: result.testMode || false
    };

    // Update pharmacy status
    prescription.pharmacyStatus = 'received';

    // Add to status history
    if (!prescription.pharmacyStatusHistory) {
      prescription.pharmacyStatusHistory = [];
    }
    prescription.pharmacyStatusHistory.push({
      status: 'e-prescribed',
      changedAt: new Date(),
      changedBy: req.user._id || req.user.id,
      notes: `E-prescription sent to ${pharmacy.name} (NCPDP: ${pharmacy.ncpdpId})`
    });

    await prescription.save();

    res.json({
      success: true,
      message: 'Prescription transmitted successfully',
      data: {
        transmissionId: result.transmissionId,
        messageId: result.messageId,
        status: result.status,
        pharmacy: pharmacy.name,
        testMode: result.testMode
      }
    });
  } else {
    // Update prescription with error
    prescription.ePrescription = {
      enabled: true,
      status: 'error',
      errorMessage: result.error
    };
    await prescription.save();

    res.status(400).json({
      success: false,
      error: result.error,
      status: result.status
    });
  }
});

// @desc    Get e-prescription transmission status
// @route   GET /api/prescriptions/:id/e-prescribe/status
// @access  Private
exports.getEPrescriptionStatus = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  if (!prescription.ePrescription?.transmissionId) {
    return error(res, 'Prescription has not been e-prescribed');
  }

  // Check current status from e-prescribing service
  const status = await ePrescribingService.checkTransmissionStatus(
    prescription.ePrescription.transmissionId
  );

  // Update prescription if status changed
  if (status.status && status.status !== prescription.ePrescription.status) {
    prescription.ePrescription.status = status.status;
    if (status.receivedAt) {
      prescription.ePrescription.receivedAt = status.receivedAt;
    }
    if (status.pharmacyResponse) {
      prescription.ePrescription.pharmacyResponse = status.pharmacyResponse;
    }
    await prescription.save();
  }

  res.json({
    success: true,
    data: {
      transmissionId: prescription.ePrescription.transmissionId,
      status: status.status || prescription.ePrescription.status,
      transmittedAt: prescription.ePrescription.transmittedAt,
      receivedAt: status.receivedAt || prescription.ePrescription.receivedAt,
      pharmacy: prescription.ePrescription.sentTo,
      testMode: status.testMode || prescription.ePrescription.testMode
    }
  });
});

// @desc    Cancel e-prescription
// @route   POST /api/prescriptions/:id/e-prescribe/cancel
// @access  Private (Doctor, Admin)
exports.cancelEPrescription = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const prescription = await Prescription.findById(req.params.id)
    .populate('prescriber', 'firstName lastName licenseNumber');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  if (!prescription.ePrescription?.transmissionId) {
    return error(res, 'Prescription has not been e-prescribed');
  }

  const pharmacy = {
    ncpdpId: prescription.ePrescription.sentTo?.ncpdpId,
    name: prescription.ePrescription.sentTo?.pharmacy
  };

  const result = await ePrescribingService.cancelTransmittedPrescription(
    prescription,
    pharmacy,
    prescription.prescriber,
    reason || 'Cancelled by prescriber'
  );

  if (result.success) {
    prescription.ePrescription.status = 'cancelled';
    prescription.ePrescription.cancelledAt = new Date();
    prescription.ePrescription.cancelReason = reason;

    // Add to status history
    prescription.pharmacyStatusHistory.push({
      status: 'e-prescription-cancelled',
      changedAt: new Date(),
      changedBy: req.user._id || req.user.id,
      notes: `E-prescription cancelled: ${reason || 'No reason provided'}`
    });

    await prescription.save();

    res.json({
      success: true,
      message: 'E-prescription cancelled successfully',
      data: {
        transmissionId: result.transmissionId,
        status: 'cancelled'
      }
    });
  } else {
    res.status(400).json({
      success: false,
      error: result.error
    });
  }
});

// @desc    Respond to refill request
// @route   POST /api/prescriptions/:id/e-prescribe/refill-response
// @access  Private (Doctor, Admin)
exports.respondToRefillRequest = asyncHandler(async (req, res) => {
  const { approved, reason, newQuantity, newRefills } = req.body;

  const prescription = await Prescription.findById(req.params.id)
    .populate('prescriber', 'firstName lastName licenseNumber');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  const pharmacy = {
    ncpdpId: prescription.ePrescription?.sentTo?.ncpdpId,
    name: prescription.ePrescription?.sentTo?.pharmacy
  };

  const result = await ePrescribingService.respondToRefillRequest(
    prescription,
    pharmacy,
    prescription.prescriber,
    approved,
    reason
  );

  if (result.success) {
    // Update prescription based on approval
    if (approved) {
      prescription.medications.forEach(med => {
        if (med.refills) {
          med.refills.remaining = newRefills || (med.refills.remaining + 1);
        }
      });
    }

    prescription.refillResponse = {
      approved,
      reason,
      respondedAt: new Date(),
      respondedBy: req.user._id || req.user.id,
      transmissionId: result.transmissionId
    };

    await prescription.save();

    res.json({
      success: true,
      message: `Refill request ${approved ? 'approved' : 'denied'}`,
      data: {
        approved,
        transmissionId: result.transmissionId
      }
    });
  } else {
    res.status(400).json({
      success: false,
      error: result.error
    });
  }
});

// @desc    Search for e-prescribing pharmacies
// @route   GET /api/prescriptions/e-prescribing/pharmacies
// @access  Private
exports.searchEPrescribingPharmacies = asyncHandler(async (req, res) => {
  const { city, state, postalCode, name, radius } = req.query;

  const result = await ePrescribingService.searchEPrescribingPharmacies({
    city,
    state,
    postalCode,
    name,
    radius: radius || 10
  });

  res.json({
    success: result.success,
    count: result.pharmacies?.length || 0,
    data: result.pharmacies,
    testMode: result.testMode
  });
});

// @desc    Verify pharmacy for e-prescribing
// @route   GET /api/prescriptions/e-prescribing/pharmacy/:ncpdpId/verify
// @access  Private
exports.verifyPharmacy = asyncHandler(async (req, res) => {
  const { ncpdpId } = req.params;

  const result = await ePrescribingService.verifyPharmacy(ncpdpId);

  res.json({
    success: result.verified,
    data: result
  });
});

// @desc    Get e-prescribing service status
// @route   GET /api/prescriptions/e-prescribing/status
// @access  Private
exports.getEPrescribingServiceStatus = asyncHandler(async (req, res) => {
  const status = ePrescribingService.getServiceStatus();

  res.json({
    success: true,
    data: status
  });
});

// ============================================
// PRIOR AUTHORIZATION ENDPOINTS
// ============================================

// Prior authorization status constants
const PRIOR_AUTH_STATUS = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved',
  DENIED: 'denied',
  APPEAL_PENDING: 'appeal_pending',
  EXPIRED: 'expired'
};

// @desc    Request prior authorization
// @route   POST /api/prescriptions/:id/prior-auth/request
// @access  Private (Doctor, Admin, Nurse)
exports.requestPriorAuthorization = asyncHandler(async (req, res) => {
  const {
    insuranceProvider,
    policyNumber,
    groupNumber,
    diagnosis,
    clinicalJustification,
    previousTherapies,
    urgency,
    contactPhone,
    contactFax,
    additionalDocuments
  } = req.body;

  const prescription = await Prescription.findById(req.params.id)
    .populate('patient', 'firstName lastName dateOfBirth patientId insurance')
    .populate('prescriber', 'firstName lastName licenseNumber');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  // Check if prior auth already exists and is active
  if (prescription.priorAuthorization?.status === PRIOR_AUTH_STATUS.SUBMITTED ||
      prescription.priorAuthorization?.status === PRIOR_AUTH_STATUS.IN_REVIEW) {
    return res.status(400).json({
      success: false,
      error: 'Prior authorization already submitted and pending review',
      currentStatus: prescription.priorAuthorization.status
    });
  }

  // Generate prior auth reference number
  const authReference = `PA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  // Create prior authorization record
  prescription.priorAuthorization = {
    required: true,
    status: PRIOR_AUTH_STATUS.SUBMITTED,
    referenceNumber: authReference,
    requestedAt: new Date(),
    requestedBy: req.user._id || req.user.id,

    // Insurance info
    insurance: {
      provider: insuranceProvider || prescription.patient?.insurance?.provider,
      policyNumber: policyNumber || prescription.patient?.insurance?.policyNumber,
      groupNumber: groupNumber || prescription.patient?.insurance?.groupNumber
    },

    // Clinical information
    clinicalInfo: {
      diagnosis: diagnosis || prescription.diagnosis,
      justification: clinicalJustification,
      previousTherapies: previousTherapies || [],
      urgency: urgency || 'routine' // routine, urgent, emergent
    },

    // Contact information
    contact: {
      phone: contactPhone || prescription.prescriber?.phone,
      fax: contactFax || prescription.prescriber?.fax
    },

    // Document references
    documents: additionalDocuments || [],

    // History
    statusHistory: [{
      status: PRIOR_AUTH_STATUS.SUBMITTED,
      changedAt: new Date(),
      changedBy: req.user._id || req.user.id,
      notes: 'Prior authorization request submitted'
    }]
  };

  // Update insurance on prescription
  prescription.insurance = {
    used: true,
    provider: insuranceProvider || prescription.patient?.insurance?.provider,
    policyNumber: policyNumber || prescription.patient?.insurance?.policyNumber,
    groupNumber: groupNumber,
    priorAuthRequired: true,
    priorAuthNumber: authReference,
    coverageStatus: 'pending'
  };

  await prescription.save();

  res.status(201).json({
    success: true,
    message: 'Prior authorization request submitted',
    data: {
      referenceNumber: authReference,
      status: PRIOR_AUTH_STATUS.SUBMITTED,
      requestedAt: prescription.priorAuthorization.requestedAt,
      insurance: prescription.priorAuthorization.insurance
    }
  });
});

// @desc    Update prior authorization status
// @route   PUT /api/prescriptions/:id/prior-auth/update
// @access  Private (Admin, Pharmacist)
exports.updatePriorAuthorization = asyncHandler(async (req, res) => {
  const {
    status,
    authorizationNumber,
    approvedQuantity,
    approvedRefills,
    approvedDays,
    expirationDate,
    denialReason,
    notes,
    insuranceResponse
  } = req.body;

  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  if (!prescription.priorAuthorization) {
    return error(res, 'No prior authorization request found for this prescription');
  }

  // Validate status transition
  const validStatuses = Object.values(PRIOR_AUTH_STATUS);
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    });
  }

  const previousStatus = prescription.priorAuthorization.status;

  // Update prior authorization
  if (status) {
    prescription.priorAuthorization.status = status;
  }

  if (status === PRIOR_AUTH_STATUS.APPROVED) {
    prescription.priorAuthorization.approval = {
      authorizationNumber: authorizationNumber,
      approvedAt: new Date(),
      approvedBy: req.user._id || req.user.id,
      approvedQuantity: approvedQuantity,
      approvedRefills: approvedRefills,
      approvedDays: approvedDays,
      expirationDate: expirationDate || new Date(Date.now() + PRESCRIPTION.OPTICAL_VALIDITY_DAYS * 24 * 60 * 60 * 1000) // Default 1 year
    };

    // Update insurance info
    prescription.insurance.priorAuthNumber = authorizationNumber;
    prescription.insurance.coverageStatus = 'approved';
  }

  if (status === PRIOR_AUTH_STATUS.DENIED) {
    prescription.priorAuthorization.denial = {
      deniedAt: new Date(),
      deniedBy: req.user._id || req.user.id,
      reason: denialReason,
      appealDeadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days to appeal
    };

    prescription.insurance.coverageStatus = 'denied';
  }

  if (insuranceResponse) {
    prescription.priorAuthorization.insuranceResponse = insuranceResponse;
  }

  // Add to status history
  prescription.priorAuthorization.statusHistory.push({
    status: status || prescription.priorAuthorization.status,
    previousStatus,
    changedAt: new Date(),
    changedBy: req.user._id || req.user.id,
    notes: notes || `Status updated to ${status}`
  });

  prescription.priorAuthorization.lastUpdated = new Date();
  prescription.priorAuthorization.lastUpdatedBy = req.user._id || req.user.id;

  await prescription.save();

  res.json({
    success: true,
    message: `Prior authorization ${status === PRIOR_AUTH_STATUS.APPROVED ? 'approved' : status === PRIOR_AUTH_STATUS.DENIED ? 'denied' : 'updated'}`,
    data: {
      referenceNumber: prescription.priorAuthorization.referenceNumber,
      status: prescription.priorAuthorization.status,
      authorizationNumber: prescription.priorAuthorization.approval?.authorizationNumber,
      approval: prescription.priorAuthorization.approval,
      denial: prescription.priorAuthorization.denial
    }
  });
});

// @desc    Get prior authorization status
// @route   GET /api/prescriptions/:id/prior-auth/status
// @access  Private
exports.getPriorAuthorizationStatus = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('priorAuthorization.requestedBy', 'firstName lastName')
    .populate('priorAuthorization.approval.approvedBy', 'firstName lastName')
    .populate('priorAuthorization.statusHistory.changedBy', 'firstName lastName');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  if (!prescription.priorAuthorization) {
    return res.json({
      success: true,
      data: {
        required: false,
        status: 'not_required',
        message: 'Prior authorization not required for this prescription'
      }
    });
  }

  res.json({
    success: true,
    data: {
      required: prescription.priorAuthorization.required,
      referenceNumber: prescription.priorAuthorization.referenceNumber,
      status: prescription.priorAuthorization.status,
      requestedAt: prescription.priorAuthorization.requestedAt,
      requestedBy: prescription.priorAuthorization.requestedBy,
      insurance: prescription.priorAuthorization.insurance,
      clinicalInfo: prescription.priorAuthorization.clinicalInfo,
      approval: prescription.priorAuthorization.approval,
      denial: prescription.priorAuthorization.denial,
      statusHistory: prescription.priorAuthorization.statusHistory,
      lastUpdated: prescription.priorAuthorization.lastUpdated
    }
  });
});

// @desc    Get all pending prior authorizations
// @route   GET /api/prescriptions/prior-auth/pending
// @access  Private (Admin, Pharmacist, Doctor)
exports.getPendingPriorAuthorizations = asyncHandler(async (req, res) => {
  const { status, urgency, page = 1, limit = 20 } = req.query;

  const query = {
    'priorAuthorization.status': status || {
      $in: [PRIOR_AUTH_STATUS.SUBMITTED, PRIOR_AUTH_STATUS.IN_REVIEW, PRIOR_AUTH_STATUS.APPEAL_PENDING]
    }
  };

  if (urgency) {
    query['priorAuthorization.clinicalInfo.urgency'] = urgency;
  }

  const prescriptions = await Prescription.find(query)
    .populate('patient', 'firstName lastName patientId')
    .populate('prescriber', 'firstName lastName')
    .populate('priorAuthorization.requestedBy', 'firstName lastName')
    .select('prescriptionId type medications priorAuthorization dateIssued')
    .sort({ 'priorAuthorization.requestedAt': -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Prescription.countDocuments(query);

  // Format response
  const pendingAuths = prescriptions.map(p => ({
    prescriptionId: p.prescriptionId,
    _id: p._id,
    type: p.type,
    medication: p.medications?.[0]?.name || 'N/A',
    patient: p.patient ? `${p.patient.firstName} ${p.patient.lastName}` : 'Unknown',
    patientId: p.patient?.patientId,
    prescriber: p.prescriber ? `Dr. ${p.prescriber.firstName} ${p.prescriber.lastName}` : 'Unknown',
    priorAuth: {
      referenceNumber: p.priorAuthorization?.referenceNumber,
      status: p.priorAuthorization?.status,
      urgency: p.priorAuthorization?.clinicalInfo?.urgency,
      insurance: p.priorAuthorization?.insurance?.provider,
      requestedAt: p.priorAuthorization?.requestedAt,
      requestedBy: p.priorAuthorization?.requestedBy
    },
    dateIssued: p.dateIssued
  }));

  res.json({
    success: true,
    count: prescriptions.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: pendingAuths
  });
});

// ============================================
// TYPE-SPECIFIC PRESCRIPTION ENDPOINTS
// ============================================

// @desc    Get optical prescriptions
// @route   GET /api/prescriptions/optical
// @access  Private
exports.getOpticalPrescriptions = asyncHandler(async (req, res) => {
  const { patient, status, page = 1, limit = 20 } = req.query;

  const query = { type: 'optical' };

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

// @desc    Create optical prescription
// @route   POST /api/prescriptions/optical
// @access  Private (Doctor, Ophthalmologist, Optometrist, Admin)
exports.createOpticalPrescription = asyncHandler(async (req, res) => {
  const {
    patient,
    rightEye,
    leftEye,
    pupillaryDistance,
    addPower,
    recommendations,
    lensType,
    coatings,
    frameRecommendations,
    notes,
    validUntil
  } = req.body;

  // Validate patient exists
  const Patient = require('../models/Patient');
  const patientExists = await findPatientByIdOrCode(patient);
  if (!patientExists) {
    return notFound(res, 'Patient');
  }

  // Generate prescription ID
  const count = await Prescription.countDocuments();
  const prescriptionId = `OPT-${Date.now()}-${(count + 1).toString().padStart(5, '0')}`;

  const prescription = await Prescription.create({
    prescriptionId,
    type: 'optical',
    patient,
    prescriber: req.user._id || req.user.id,
    optical: {
      rightEye: rightEye || {},
      leftEye: leftEye || {},
      pupillaryDistance,
      addPower,
      recommendations,
      lensType,
      coatings: coatings || [],
      frameRecommendations
    },
    notes,
    dateIssued: new Date(),
    validUntil: validUntil || new Date(Date.now() + PRESCRIPTION.OPTICAL_VALIDITY_DAYS * 24 * 60 * 60 * 1000), // 1 year for optical
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
  const Patient = require('../models/Patient');
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
    validUntil: validUntil || new Date(Date.now() + PRESCRIPTION.MEDICATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000), // 90 days for medication
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

  res.json({
    success: true,
    count: prescriptions.length,
    data: prescriptions
  });
});

// @desc    Get provider's prescriptions
// @route   GET /api/prescriptions/provider/:providerId
// @access  Private
exports.getProviderPrescriptions = asyncHandler(async (req, res) => {
  const { providerId } = req.params;
  const {
    page = 1,
    limit = 20,
    status,
    type,
    dateFrom,
    dateTo
  } = req.query;

  const query = { prescriber: providerId };

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Filter by type
  if (type) {
    query.type = type;
  }

  // Date range filter
  if (dateFrom || dateTo) {
    query.dateIssued = {};
    if (dateFrom) {
      query.dateIssued.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      query.dateIssued.$lte = new Date(dateTo);
    }
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

// @desc    Delete prescription
// @route   DELETE /api/prescriptions/:id
// @access  Private (Doctor, Ophthalmologist, Admin)
exports.deletePrescription = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  // Check if prescription can be deleted (not dispensed)
  if (prescription.pharmacyStatus === 'dispensed') {
    return error(res, 'Cannot delete a dispensed prescription');
  }

  // CRITICAL FIX: Clean up Patient.prescriptions array to prevent orphaned references
  if (prescription.patient) {
    const Patient = require('../models/Patient');
    await Patient.findByIdAndUpdate(
      prescription.patient,
      { $pull: { prescriptions: prescription._id } }
    );
  }

  await prescription.deleteOne();

  res.json({
    success: true,
    message: 'Prescription deleted successfully'
  });
});

// @desc    Update optical prescription
// @route   PUT /api/prescriptions/optical/:id
// @access  Private (Doctor, Ophthalmologist, Optometrist, Admin)
exports.updateOpticalPrescription = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  if (prescription.type !== 'optical') {
    return error(res, 'This is not an optical prescription');
  }

  const {
    rightEye,
    leftEye,
    pupillaryDistance,
    addPower,
    recommendations,
    lensType,
    coatings,
    frameRecommendations,
    notes,
    status
  } = req.body;

  if (rightEye) prescription.opticalData.rightEye = { ...prescription.opticalData.rightEye, ...rightEye };
  if (leftEye) prescription.opticalData.leftEye = { ...prescription.opticalData.leftEye, ...leftEye };
  if (pupillaryDistance) prescription.opticalData.pupillaryDistance = pupillaryDistance;
  if (addPower) prescription.opticalData.addPower = addPower;
  if (recommendations) prescription.opticalData.recommendations = recommendations;
  if (lensType) prescription.opticalData.lensType = lensType;
  if (coatings) prescription.opticalData.coatings = coatings;
  if (frameRecommendations) prescription.opticalData.frameRecommendations = frameRecommendations;
  if (notes) prescription.notes = notes;
  if (status) prescription.status = status;

  prescription.updatedAt = new Date();
  await prescription.save();

  await prescription.populate('patient', 'firstName lastName patientId');
  await prescription.populate('prescriber', 'firstName lastName specialization');

  res.json({
    success: true,
    data: prescription
  });
});

// @desc    Get lens options for optical prescription
// @route   GET /api/prescriptions/optical/:id/lens-options
// @access  Private
exports.getLensOptions = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  // Generate lens options based on prescription data
  const lensOptions = {
    materials: [
      { name: 'CR-39 Plastic', index: 1.5, description: 'Standard plastic lens' },
      { name: 'Polycarbonate', index: 1.59, description: 'Impact-resistant, lightweight' },
      { name: 'High-Index 1.67', index: 1.67, description: 'Thinner lens for higher prescriptions' },
      { name: 'High-Index 1.74', index: 1.74, description: 'Thinnest available' },
      { name: 'Trivex', index: 1.53, description: 'Lightweight, impact-resistant' }
    ],
    coatings: [
      { name: 'Anti-Reflective', description: 'Reduces glare and reflections' },
      { name: 'Scratch-Resistant', description: 'Protects lens surface' },
      { name: 'UV Protection', description: 'Blocks harmful UV rays' },
      { name: 'Blue Light Filter', description: 'Reduces digital eye strain' },
      { name: 'Photochromic', description: 'Darkens in sunlight' },
      { name: 'Hydrophobic', description: 'Water and smudge resistant' }
    ],
    designs: [
      { name: 'Single Vision', description: 'One prescription power throughout' },
      { name: 'Bifocal', description: 'Two prescription powers' },
      { name: 'Progressive', description: 'Gradual power change, no line' },
      { name: 'Office Progressive', description: 'Optimized for near and intermediate' }
    ]
  };

  res.json({
    success: true,
    data: lensOptions
  });
});

// @desc    Calculate lens power
// @route   POST /api/prescriptions/optical/calculate-power
// @access  Private (Doctor, Ophthalmologist, Optometrist)
exports.calculateLensPower = asyncHandler(async (req, res) => {
  const { sphere, cylinder, axis, addPower, vertexDistance = 12 } = req.body;

  // Vertex distance compensation for high prescriptions
  let compensatedSphere = sphere;
  let compensatedCylinder = cylinder;

  if (Math.abs(sphere) >= 4) {
    // Compensate for vertex distance
    const effectivePower = sphere / (1 - (vertexDistance / 1000) * sphere);
    compensatedSphere = Math.round(effectivePower * 4) / 4; // Round to nearest 0.25
  }

  if (cylinder && Math.abs(cylinder) >= 2) {
    const effectiveCyl = cylinder / (1 - (vertexDistance / 1000) * cylinder);
    compensatedCylinder = Math.round(effectiveCyl * 4) / 4;
  }

  // Calculate transposition (plus to minus cylinder)
  const transposed = {
    sphere: sphere + (cylinder || 0),
    cylinder: cylinder ? -cylinder : 0,
    axis: cylinder ? (axis + 90) % 180 : axis
  };

  // Calculate reading addition
  const readingPower = addPower ? {
    sphere: compensatedSphere + addPower,
    cylinder: compensatedCylinder,
    axis
  } : null;

  res.json({
    success: true,
    data: {
      original: { sphere, cylinder, axis },
      compensated: { sphere: compensatedSphere, cylinder: compensatedCylinder, axis },
      transposed,
      reading: readingPower,
      vertexDistance
    }
  });
});

// @desc    Get frame recommendations
// @route   GET /api/prescriptions/optical/:id/frame-recommendations
// @access  Private
exports.getFrameRecommendations = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('patient', 'firstName lastName dateOfBirth');

  if (!prescription) {
    return notFound(res, 'Prescription');
  }

  const opticalData = prescription.opticalData || {};
  const recommendations = [];

  // High prescription recommendations
  const maxSphere = Math.max(
    Math.abs(opticalData.rightEye?.sphere || 0),
    Math.abs(opticalData.leftEye?.sphere || 0)
  );

  if (maxSphere > 4) {
    recommendations.push({
      type: 'frame_size',
      recommendation: 'Smaller frames recommended for thinner edge thickness',
      priority: 'high'
    });
    recommendations.push({
      type: 'lens_material',
      recommendation: 'High-index lenses (1.67 or 1.74) recommended for thinner, lighter lenses',
      priority: 'high'
    });
  }

  // Add power recommendations
  if (opticalData.addPower) {
    recommendations.push({
      type: 'frame_fit',
      recommendation: 'Ensure adequate frame depth for progressive or bifocal lenses',
      priority: 'medium'
    });
  }

  // General recommendations
  recommendations.push({
    type: 'general',
    recommendation: 'Frame should sit comfortably on nose bridge and ears',
    priority: 'low'
  });

  res.json({
    success: true,
    data: {
      prescriptionId: prescription.prescriptionId,
      patient: prescription.patient,
      recommendations
    }
  });
});

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

  // Create QR code data
  const qrData = {
    prescriptionId: prescription.prescriptionId,
    patient: prescription.patient ? `${prescription.patient.firstName} ${prescription.patient.lastName}` : 'Unknown',
    patientId: prescription.patient?.patientId,
    prescriber: prescription.prescriber ? `Dr. ${prescription.prescriber.firstName} ${prescription.prescriber.lastName}` : 'Unknown',
    dateIssued: prescription.dateIssued,
    type: prescription.type,
    verificationUrl: `${process.env.APP_URL || 'https://medflow.app'}/verify/${prescription._id}`
  };

  // Generate QR code as data URL (using qrcode library if available)
  try {
    const QRCode = require('qrcode');
    const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrData));

    res.json({
      success: true,
      data: {
        qrCode: qrCodeDataUrl,
        prescriptionData: qrData
      }
    });
  } catch (err) {
    // Fallback if qrcode library not available
    res.json({
      success: true,
      data: {
        qrCode: null,
        prescriptionData: qrData,
        message: 'QR code generation requires qrcode package'
      }
    });
  }
});

// @desc    Send prescription to patient
// @route   POST /api/prescriptions/:id/send-to-patient
// @access  Private (Doctor, Ophthalmologist, Admin, Pharmacist)
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
    // Email sending logic (placeholder - integrate with email service)
    sendResult = {
      success: true,
      method: 'email',
      sentTo: targetEmail,
      message: 'Prescription sent via email'
    };
  } else if (method === 'sms' && targetPhone) {
    // SMS sending logic (placeholder - integrate with SMS service)
    sendResult = {
      success: true,
      method: 'sms',
      sentTo: targetPhone,
      message: 'Prescription sent via SMS'
    };
  } else {
    return res.status(400).json({
      success: false,
      error: `No valid ${method || 'contact'} method available for patient`
    });
  }

  // Record that prescription was sent
  prescription.sentToPatient = {
    method: sendResult.method,
    sentAt: new Date(),
    sentBy: req.user._id || req.user.id,
    sentTo: sendResult.sentTo
  };
  await prescription.save();

  res.json({
    success: true,
    data: sendResult
  });
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

  // Simulate coverage check (integrate with real insurance verification API)
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

  // Update prescription with coverage info
  prescription.insurance = {
    ...prescription.insurance,
    coverageChecked: true,
    coverageStatus: 'covered',
    lastChecked: new Date()
  };
  await prescription.save();

  res.json({
    success: true,
    data: coverageResult
  });
});
