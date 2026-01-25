/**
 * Consultation Completion Service
 *
 * Orchestrates all cross-domain operations when a StudioVision consultation is completed:
 * 1. Save/update ophthalmology exam data
 * 2. Create lab orders from diagnostic panel
 * 3. Create prescriptions from treatment builder
 * 4. Generate invoice from all billable items
 * 5. Surgery cases are auto-created when invoice is paid (via existing SurgeryService)
 *
 * Uses MongoDB transactions for atomicity across all operations.
 */

const mongoose = require('mongoose');
const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('ConsultationCompletion');

// Models
const OphthalmologyExam = require('../models/OphthalmologyExam');
const LabOrder = require('../models/LabOrder');
const Prescription = require('../models/Prescription');
const Invoice = require('../models/Invoice');
const Visit = require('../models/Visit');
const Patient = require('../models/Patient');
const FeeSchedule = require('../models/FeeSchedule');
const ClinicalAct = require('../models/ClinicalAct');
const Company = require('../models/Company');
const Approval = require('../models/Approval');
const ConventionFeeSchedule = require('../models/ConventionFeeSchedule');

// Services
const drugSafetyService = require('./drugSafetyService');
const websocketService = require('./websocketService');

// Transaction helper (graceful fallback for standalone MongoDB)
const { withTransaction, supportsTransactions } = require('../utils/migrationTransaction');

// Saga pattern for non-transactional environments
const { executeConsultationSaga, SagaStatus } = require('./consultationSaga');

/**
 * Complete a consultation with all integrated operations
 *
 * @param {Object} params
 * @param {string} params.examId - OphthalmologyExam ID (or null for new)
 * @param {string} params.patientId - Patient ID
 * @param {string} params.visitId - Visit ID
 * @param {string} params.clinicId - Clinic ID
 * @param {string} params.userId - Current user ID (examiner/prescriber)
 * @param {Object} params.examData - Full exam data from StudioVision
 * @param {Object} params.options - Additional options
 * @returns {Promise<Object>} Result with created records
 */
async function completeConsultation({
  examId,
  patientId,
  visitId,
  clinicId,
  userId,
  examData,
  options = {}
}) {
  const result = {
    exam: null,
    labOrders: [],
    prescriptions: [],
    invoice: null,
    warnings: [],
    errors: []
  };

  log.info('Starting consultation completion', {
    patientId,
    visitId,
    clinicId,
    hasLabTests: examData.diagnostic?.laboratory?.length > 0,
    hasPrescriptions: examData.prescription?.medications?.length > 0,
    hasSurgery: examData.diagnostic?.surgery?.length > 0,
    hasProcedures: examData.diagnostic?.procedures?.length > 0
  });

  try {
    // Use transaction helper (gracefully handles standalone MongoDB)
    await withTransaction(async (session) => {

      // 1. Save/Update Ophthalmology Exam
      result.exam = await saveExam({
        examId,
        patientId,
        visitId,
        clinicId,
        userId,
        examData,
        session
      });

      // 2. Create Lab Orders if any
      if (examData.diagnostic?.laboratory?.length > 0) {
        const labResult = await createLabOrders({
          patientId,
          visitId,
          clinicId,
          userId,
          labTests: examData.diagnostic.laboratory,
          session
        });
        result.labOrders = labResult.orders;
        if (labResult.warnings?.length) {
          result.warnings.push(...labResult.warnings);
        }
      }

      // 3. Create Prescriptions if any medications
      if (examData.prescription?.medications?.length > 0) {
        const prescriptionResult = await createPrescriptions({
          patientId,
          visitId,
          clinicId,
          userId,
          medications: examData.prescription.medications,
          opticalPrescription: examData.prescription?.optical,
          session
        });
        result.prescriptions = prescriptionResult.prescriptions;
        if (prescriptionResult.warnings?.length) {
          result.warnings.push(...prescriptionResult.warnings);
        }
      }

      // 4. Create optical prescription if refraction was done
      if (examData.refraction && hasValidRefraction(examData.refraction)) {
        const opticalRx = await createOpticalPrescription({
          patientId,
          visitId,
          clinicId,
          userId,
          refractionData: examData.refraction,
          session
        });
        if (opticalRx) {
          result.prescriptions.push(opticalRx);
        }
      }

      // 5. Generate Invoice from all billable items
      // This includes convention billing, fee schedule lookups, and approval checks
      const invoiceResult = await generateInvoice({
        patientId,
        visitId,
        clinicId,
        userId,
        examData,
        createdRecords: result,
        session
      });
      result.invoice = invoiceResult.invoice;

      // Add invoice warnings (convention info, approval requirements, annual limits)
      if (invoiceResult.warnings?.length > 0) {
        result.warnings.push(...invoiceResult.warnings);
      }

      // Track approval issues separately for frontend to handle
      if (invoiceResult.approvalIssues?.length > 0) {
        result.approvalIssues = invoiceResult.approvalIssues;
      }

      // Add convention billing info to result
      if (result.invoice?.companyBilling) {
        result.conventionBilling = {
          companyName: result.invoice.companyBilling.companyName,
          companyShare: result.invoice.companyBilling.companyShare,
          patientShare: result.invoice.companyBilling.patientShare,
          coveragePercentage: result.invoice.companyBilling.coveragePercentage,
          isWaitingPeriod: result.invoice.companyBilling.waitingPeriodActive
        };
      }

      // 6. Update Visit status
      const updateOptions = session ? { session } : {};
      await Visit.findByIdAndUpdate(
        visitId,
        {
          status: 'completed',
          completedAt: new Date(),
          completedBy: userId,
          ophthalmologyExam: result.exam._id,
          invoice: result.invoice?._id
        },
        updateOptions
      );
    }); // End withTransaction

    log.info('Consultation completed successfully', {
      examId: result.exam._id,
      labOrderCount: result.labOrders.length,
      prescriptionCount: result.prescriptions.length,
      invoiceId: result.invoice?._id,
      warningCount: result.warnings.length
    });

    // Send real-time notifications
    await sendNotifications(result, clinicId);

    return {
      success: true,
      data: result
    };

  } catch (error) {
    log.error('Consultation completion failed', {
      error: error.message,
      patientId,
      visitId
    });

    return {
      success: false,
      error: error.message,
      data: result
    };
  }
}

/**
 * Save or update ophthalmology exam
 */
async function saveExam({ examId, patientId, visitId, clinicId, userId, examData, session }) {
  try {
    const examPayload = {
    patient: patientId,
    visit: visitId,
    clinic: clinicId,
    examiner: userId,
    // Exam type (required) - default to 'routine' if not specified
    examType: examData.examType || 'routine',
    // Core exam data
    visualAcuity: examData.visualAcuity,
    refraction: examData.refraction,
    tonometry: examData.tonometry || examData.iop,
    slitLamp: examData.slitLamp || examData.anteriorSegment,
    fundus: examData.fundus || examData.posteriorSegment,
    keratometry: examData.keratometry,
    pachymetry: examData.pachymetry,
    gonioscopy: examData.gonioscopy,
    // Diagnostic data
    assessment: examData.diagnostic?.diagnoses || examData.assessment,
    diagnoses: examData.diagnostic?.diagnoses?.map(d => ({
      code: d.code,
      description: d.description || d.name,
      eye: d.eye,
      severity: d.severity,
      isPrimary: d.isPrimary
    })),
    // Clinical notes
    chiefComplaint: examData.chiefComplaint,
    historyOfPresentIllness: examData.historyOfPresentIllness,
    plan: examData.plan,
    notes: examData.notes,
    // Orthoptics if present
    orthoptics: examData.orthoptics,
    // Device measurements if imported
    deviceMeasurements: examData.deviceMeasurements,
    // Schemas/drawings
    schemas: examData.schemas,
    // Status
    status: 'completed',
    completedAt: new Date(),
    updatedAt: new Date()
  };

    if (examId) {
      // Update existing exam
      const updateOptions = { new: true };
      if (session) updateOptions.session = session;
      const exam = await OphthalmologyExam.findByIdAndUpdate(
        examId,
        { $set: examPayload },
        updateOptions
      );
      return exam;
    } else {
      // Create new exam
      const exam = new OphthalmologyExam(examPayload);
      await exam.save(session ? { session } : {});
      return exam;
    }
  } catch (error) {
    log.error('Failed to save exam:', {
      error: error.message,
      examId,
      patientId: String(patientId), // ID only, no PHI
      visitId: String(visitId)
    });
    throw new Error('Erreur lors de l\'enregistrement de l\'examen');
  }
}

/**
 * Create lab orders from diagnostic panel
 */
async function createLabOrders({ patientId, visitId, clinicId, userId, labTests, session }) {
  const orders = [];
  const warnings = [];

  try {
    // Group tests by specimen type for efficiency
    const testsBySpecimen = groupTestsBySpecimen(labTests);

    for (const [specimenType, tests] of Object.entries(testsBySpecimen)) {
      try {
        const labOrder = new LabOrder({
          patient: patientId,
          visit: visitId,
          clinic: clinicId,
          orderedBy: userId,
          orderDate: new Date(),
          priority: determinePriority(tests),
          status: 'ordered',
          tests: tests.map(test => ({
            testName: test.name || test.testName,
            testCode: test.code || test.testCode,
            category: test.category,
            specimen: test.specimenType || specimenType,
            status: 'pending',
            notes: test.notes
          })),
          specimen: {
            specimenType
          },
          clinicalInfo: tests[0]?.clinicalInfo || '',
          notes: 'Ordered from ophthalmology consultation'
        });

        await labOrder.save(session ? { session } : {});
        orders.push(labOrder);

        log.info('Lab order created', {
          orderId: labOrder._id,
          testCount: tests.length,
          specimenType
        });
      } catch (orderError) {
        log.error('Failed to create lab order:', {
          error: orderError.message,
          specimenType,
          patientId: String(patientId)
        });
        warnings.push({
          type: 'lab_order_failed',
          message: `Erreur lors de la création de la commande labo pour ${specimenType}`
        });
      }
    }

    return { orders, warnings };
  } catch (error) {
    log.error('Failed to create lab orders:', {
      error: error.message,
      patientId: String(patientId),
      testCount: labTests?.length
    });
    return {
      orders: [],
      warnings: [{ type: 'lab_orders_failed', message: 'Erreur lors de la création des commandes laboratoire' }]
    };
  }
}

/**
 * Create medication prescriptions
 */
async function createPrescriptions({ patientId, visitId, clinicId, userId, medications, session }) {
  const prescriptions = [];
  const warnings = [];

  try {
    // Get patient for safety checks
    const patient = await Patient.findById(patientId).select('allergies dateOfBirth gender currentMedications');

  // Run drug safety checks
  if (medications.length > 0) {
    try {
      const safetyResult = await drugSafetyService.checkPrescriptionSafety({
        medications: medications.map(m => ({
          name: m.name || m.drugName,
          genericName: m.genericName,
          dose: m.dose,
          route: m.route
        })),
        patientAllergies: patient?.allergies || [],
        patientAge: calculateAge(patient?.dateOfBirth),
        patientConditions: [] // Could be populated from diagnosis
      });

      if (safetyResult.hasInteractions) {
        warnings.push({
          type: 'drug_interaction',
          message: 'Interactions médicamenteuses détectées',
          details: safetyResult.interactions
        });
      }

      if (safetyResult.hasAllergyRisks) {
        warnings.push({
          type: 'allergy_risk',
          message: 'Risque allergique détecté',
          details: safetyResult.allergyRisks
        });
      }
    } catch (safetyError) {
      log.warn('Drug safety check failed', { error: safetyError.message });
      warnings.push({
        type: 'safety_check_failed',
        message: 'Vérification de sécurité non disponible'
      });
    }
  }

  // Create prescription
  const prescription = new Prescription({
    patient: patientId,
    visit: visitId,
    clinic: clinicId,
    prescriber: userId,
    type: 'medication',
    status: 'pending',
    pharmacyStatus: 'pending',
    dateIssued: new Date(),
    validUntil: calculateValidUntil(medications),
    medications: medications.map(med => ({
      name: med.name || med.drugName,
      genericName: med.genericName,
      brand: med.brand,
      strength: med.strength || med.dose,
      form: med.form,
      route: med.route || 'ophthalmic',
      // Dosing
      dosage: med.dosage,
      frequency: med.frequency,
      duration: med.duration,
      durationUnit: med.durationUnit || 'days',
      quantity: med.quantity || calculateQuantity(med),
      // Eye-specific
      applicationSite: med.eye || med.applicationSite,
      // Instructions
      instructions: med.instructions || buildInstructions(med),
      // Safety flags
      safetyChecked: true,
      safetyWarnings: warnings.filter(w => w.type === 'drug_interaction' || w.type === 'allergy_risk')
    })),
    notes: 'Ordonnance générée depuis la consultation ophtalmologique',
    safetyChecks: {
      performed: true,
      performedAt: new Date(),
      performedBy: userId,
      hasWarnings: warnings.length > 0,
      warnings
    }
  });

    await prescription.save(session ? { session } : {});
    prescriptions.push(prescription);

    log.info('Prescription created', {
      prescriptionId: prescription._id,
      medicationCount: medications.length,
      hasWarnings: warnings.length > 0
    });

    return { prescriptions, warnings };
  } catch (error) {
    log.error('Failed to create prescription:', {
      error: error.message,
      patientId: String(patientId),
      medicationCount: medications?.length
    });
    return {
      prescriptions: [],
      warnings: [{ type: 'prescription_failed', message: 'Erreur lors de la création de l\'ordonnance' }]
    };
  }
}

/**
 * Create optical prescription from refraction data
 */
async function createOpticalPrescription({ patientId, visitId, clinicId, userId, refractionData, session }) {
  try {
    // Only create if there's actual refraction data
    if (!refractionData?.subjective?.OD && !refractionData?.subjective?.OS) {
      return null;
    }

    const prescription = new Prescription({
    patient: patientId,
    visit: visitId,
    clinic: clinicId,
    prescriber: userId,
    type: 'optical',
    status: 'pending',
    dateIssued: new Date(),
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year validity
    optical: {
      // Right eye (OD)
      rightEye: {
        sphere: refractionData.subjective?.OD?.sphere,
        cylinder: refractionData.subjective?.OD?.cylinder,
        axis: refractionData.subjective?.OD?.axis,
        add: refractionData.subjective?.OD?.add || refractionData.addition?.OD,
        prism: refractionData.subjective?.OD?.prism,
        base: refractionData.subjective?.OD?.base,
        pd: refractionData.pd?.OD || refractionData.pd?.monocular?.OD
      },
      // Left eye (OS)
      leftEye: {
        sphere: refractionData.subjective?.OS?.sphere,
        cylinder: refractionData.subjective?.OS?.cylinder,
        axis: refractionData.subjective?.OS?.axis,
        add: refractionData.subjective?.OS?.add || refractionData.addition?.OS,
        prism: refractionData.subjective?.OS?.prism,
        base: refractionData.subjective?.OS?.base,
        pd: refractionData.pd?.OS || refractionData.pd?.monocular?.OS
      },
      // Interpupillary distance
      pd: refractionData.pd?.binocular,
      // Lens type recommendations
      lensType: determineLensType(refractionData),
      // Notes
      notes: refractionData.notes
    },
    notes: 'Ordonnance optique générée depuis l\'examen de réfraction'
  });

    await prescription.save(session ? { session } : {});

    log.info('Optical prescription created', {
      prescriptionId: prescription._id
    });

    return prescription;
  } catch (error) {
    log.error('Failed to create optical prescription:', {
      error: error.message,
      patientId: String(patientId),
      visitId: String(visitId)
    });
    // Return null on failure - non-critical, don't block consultation completion
    return null;
  }
}

/**
 * Generate invoice from all billable items
 * Handles:
 * - Fee schedule price lookups
 * - Convention/company billing (split billing)
 * - Approval pre-checks for items requiring authorization
 * - Surgery case metadata for later creation on payment
 */
async function generateInvoice({ patientId, visitId, clinicId, userId, examData, createdRecords, session }) {
  const invoiceItems = [];
  const warnings = [];
  const approvalIssues = [];

  // Get patient with convention info
  const patient = await Patient.findById(patientId)
    .select('convention firstName lastName company allergies')
    .lean();

  // Get fee schedule for this clinic (with convention pricing if applicable)
  const feeSchedule = await getFeeScheduleForClinic(clinicId, patient?.convention?.company);

  // 1. Consultation fee - lookup from fee schedule
  const consultFee = await getConsultationFee(clinicId, feeSchedule);
  if (consultFee) {
    invoiceItems.push({
      type: 'consultation',
      code: consultFee.code || 'CONSULT_OPHTA',
      description: consultFee.name || 'Consultation ophtalmologique',
      quantity: 1,
      unitPrice: consultFee.price,
      category: 'consultation'
    });
  }

  // 2. Procedures from diagnostic panel - lookup prices from fee schedule
  if (examData.diagnostic?.procedures?.length > 0) {
    for (const proc of examData.diagnostic.procedures) {
      const priceInfo = await lookupItemPrice(proc.code, 'procedure', clinicId, feeSchedule);
      invoiceItems.push({
        type: 'procedure',
        code: proc.code,
        description: proc.name || proc.description,
        quantity: 1,
        unitPrice: priceInfo?.price || proc.price || 0,
        category: proc.category || 'procedure',
        eye: proc.eye
      });
    }
  }

  // 3. Lab tests - lookup prices from fee schedule
  if (examData.diagnostic?.laboratory?.length > 0) {
    for (const lab of examData.diagnostic.laboratory) {
      const priceInfo = await lookupItemPrice(lab.code, 'laboratory', clinicId, feeSchedule);
      invoiceItems.push({
        type: 'laboratory',
        code: lab.code,
        description: lab.name || lab.testName,
        quantity: 1,
        unitPrice: priceInfo?.price || lab.price || 0,
        category: 'laboratory'
      });
    }
  }

  // 4. Surgery items (will trigger SurgeryCase creation when paid via BillingService)
  if (examData.diagnostic?.surgery?.length > 0) {
    for (const surgery of examData.diagnostic.surgery) {
      const priceInfo = await lookupItemPrice(surgery.code, 'surgery', clinicId, feeSchedule);
      invoiceItems.push({
        type: 'surgery',
        code: surgery.code,
        description: surgery.name || surgery.description,
        quantity: 1,
        unitPrice: priceInfo?.price || surgery.price || 0,
        category: 'surgery',
        eye: surgery.eye,
        metadata: {
          surgeryType: surgery.code,
          eye: surgery.eye,
          surgeonId: userId,
          indication: examData.diagnostic?.diagnoses?.[0]?.description,
          diagnoses: examData.diagnostic?.diagnoses?.map(d => ({ code: d.code, description: d.description }))
        }
      });
    }
  }

  // Skip invoice creation if no items
  if (invoiceItems.length === 0) {
    log.info('No billable items, skipping invoice creation');
    return { invoice: null, warnings };
  }

  // Calculate subtotal before convention
  const subtotal = invoiceItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

  // Create invoice
  const invoice = new Invoice({
    patient: patientId,
    visit: visitId,
    clinic: clinicId,
    createdBy: userId,
    status: 'issued', // Auto-created invoices are immediately ready for payment
    items: invoiceItems.map(item => ({
      ...item,
      subtotal: item.unitPrice * item.quantity,
      total: item.unitPrice * item.quantity
    })),
    summary: {
      subtotal,
      discount: 0,
      tax: 0,
      total: subtotal,
      amountPaid: 0,
      amountDue: subtotal
    },
    billing: {
      currency: 'CDF'
    },
    source: 'visit', // Invoice created from visit/consultation
    metadata: {
      consultationType: 'studiovision',
      ophthalmologyExam: createdRecords.exam?._id,
      labOrders: createdRecords.labOrders?.map(lo => lo._id),
      prescriptions: createdRecords.prescriptions?.map(p => p._id)
    }
  });

  // Save invoice first (required before applying company billing)
  await invoice.save(session ? { session } : {});

  // ========================================
  // LINK LAB ORDERS TO INVOICE (BILL-03)
  // ========================================
  // Update lab orders with invoice reference for bidirectional linking
  if (createdRecords.labOrders?.length > 0 && invoice._id) {
    await LabOrder.updateMany(
      { _id: { $in: createdRecords.labOrders.map(lo => lo._id) } },
      {
        $set: {
          'billing.invoice': invoice._id,
          'billing.invoicedAt': new Date(),
          'billing.invoicedBy': userId
        }
      },
      session ? { session } : {}
    );
    log.info('Lab orders linked to invoice', {
      invoiceId: invoice._id,
      labOrderCount: createdRecords.labOrders.length,
      labOrderIds: createdRecords.labOrders.map(lo => lo._id)
    });
  }

  // ========================================
  // CONVENTION/COMPANY BILLING
  // ========================================
  // If patient has an active convention, apply company billing
  if (patient?.convention?.company) {
    try {
      const companyId = patient.convention.company;

      // Check if company contract is active before applying
      const company = await Company.findById(companyId).lean();
      if (company && company.contract?.status === 'active') {

        // Pre-check for items requiring approval
        const approvalCheck = await checkApprovalRequirements(invoice, company, patientId);
        if (approvalCheck.itemsNeedingApproval?.length > 0) {
          approvalIssues.push(...approvalCheck.itemsNeedingApproval);
          warnings.push({
            type: 'approval_required',
            message: `${approvalCheck.itemsNeedingApproval.length} acte(s) nécessite(nt) une approbation préalable`,
            details: approvalCheck.itemsNeedingApproval
          });
        }

        // Apply company billing (calculates company/patient shares)
        // This uses the Invoice model's applyCompanyBilling method
        await invoice.applyCompanyBilling(companyId, userId, null, {
          bypassWaitingPeriod: false,
          session
        });

        log.info('Convention billing applied', {
          invoiceId: invoice._id,
          companyId,
          companyName: company.name,
          companyShare: invoice.companyBilling?.companyShare,
          patientShare: invoice.companyBilling?.patientShare,
          coveragePercentage: invoice.companyBilling?.coveragePercentage
        });

        // Add convention info to warnings for frontend display
        if (invoice.companyBilling) {
          warnings.push({
            type: 'convention_applied',
            severity: 'info',
            message: `Convention ${company.name} appliquée`,
            details: {
              companyShare: invoice.companyBilling.companyShare,
              patientShare: invoice.companyBilling.patientShare,
              coveragePercentage: invoice.companyBilling.coveragePercentage
            }
          });
        }

        // Check for waiting period warning
        if (invoice.companyBilling?.waitingPeriodActive) {
          warnings.push({
            type: 'waiting_period',
            severity: 'warning',
            message: 'Période d\'attente active - le patient est responsable à 100%'
          });
        }

        // Check for annual limit warnings
        if (invoice.companyBilling?.annualLimitWarnings?.length > 0) {
          warnings.push({
            type: 'annual_limit',
            severity: 'warning',
            message: 'Plafonds annuels atteints pour certaines catégories',
            details: invoice.companyBilling.annualLimitWarnings
          });
        }

      } else {
        // Company contract not active
        warnings.push({
          type: 'convention_inactive',
          severity: 'warning',
          message: `Convention ${company?.name || 'inconnue'} non active - facturation standard appliquée`
        });
      }
    } catch (conventionError) {
      log.warn('Failed to apply convention billing', {
        error: conventionError.message,
        patientId,
        companyId: patient.convention.company
      });
      warnings.push({
        type: 'convention_error',
        severity: 'error',
        message: `Erreur lors de l'application de la convention: ${conventionError.message}`
      });
    }
  }

  log.info('Invoice created', {
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    itemCount: invoiceItems.length,
    subtotal,
    total: invoice.summary?.total,
    isConvention: invoice.isConventionInvoice || false,
    companyShare: invoice.companyBilling?.companyShare,
    patientShare: invoice.companyBilling?.patientShare,
    hasSurgery: invoiceItems.some(i => i.type === 'surgery'),
    warningCount: warnings.length
  });

  return {
    invoice,
    warnings,
    approvalIssues
  };
}

/**
 * Get fee schedule context for clinic, with convention-specific pricing if applicable
 *
 * NOTE: In our data model, each FeeSchedule document IS an individual fee item.
 * This function returns a context object used by lookupItemPrice for price resolution.
 */
async function getFeeScheduleForClinic(clinicId, companyId = null) {
  try {
    // Return a context object that lookupItemPrice will use for price resolution
    return {
      clinicId,
      companyId,
      hasConvention: !!companyId
    };
  } catch (error) {
    log.warn('Fee schedule context creation failed', { error: error.message, clinicId });
    return { clinicId, companyId: null, hasConvention: false };
  }
}

/**
 * Look up price for an item from fee schedule
 *
 * Price resolution chain:
 * 1. Convention-specific price (if patient has convention) - ConventionFeeSchedule
 * 2. Clinic-specific price (FeeSchedule with clinic set)
 * 3. Template price (FeeSchedule with isTemplate: true)
 * 4. ClinicalAct.pricing.basePrice (fallback)
 *
 * @param {string} code - Service/procedure code
 * @param {string} type - Type of service (imaging, laboratory, surgery, etc.)
 * @param {string} clinicId - Current clinic ID
 * @param {Object} feeScheduleContext - Context from getFeeScheduleForClinic
 */
async function lookupItemPrice(code, type, clinicId, feeScheduleContext = null) {
  if (!code) return null;

  const upperCode = code.toUpperCase();

  try {
    // 1. Check convention-specific pricing first (if patient has convention)
    if (feeScheduleContext?.companyId) {
      const conventionPrice = await ConventionFeeSchedule.findOne({
        company: feeScheduleContext.companyId,
        clinic: clinicId,
        'items.code': upperCode,
        active: true
      }).lean();

      if (conventionPrice?.items) {
        const item = conventionPrice.items.find(i => i.code?.toUpperCase() === upperCode);
        if (item) {
          return {
            price: item.price,
            name: item.name || item.description,
            source: 'convention_fee_schedule',
            conventionId: conventionPrice._id
          };
        }
      }
    }

    // 2. Check clinic-specific price (individual FeeSchedule item for this clinic)
    const clinicPrice = await FeeSchedule.findOne({
      code: upperCode,
      clinic: clinicId,
      isTemplate: false,
      active: true,
      $or: [
        { effectiveTo: null },
        { effectiveTo: { $gte: new Date() } }
      ]
    }).lean();

    if (clinicPrice) {
      return {
        price: clinicPrice.price,
        name: clinicPrice.name,
        source: 'clinic_fee_schedule',
        currency: clinicPrice.currency
      };
    }

    // 3. Check template price (central/default price)
    const templatePrice = await FeeSchedule.findOne({
      code: upperCode,
      isTemplate: true,
      active: true,
      $or: [
        { effectiveTo: null },
        { effectiveTo: { $gte: new Date() } }
      ]
    }).lean();

    if (templatePrice) {
      return {
        price: templatePrice.price,
        name: templatePrice.name,
        source: 'template_fee_schedule',
        currency: templatePrice.currency
      };
    }

    // 4. Fall back to ClinicalAct base prices
    const act = await ClinicalAct.findOne({
      $or: [
        { actId: { $regex: new RegExp(`^${upperCode}$`, 'i') } },
        { name: { $regex: new RegExp(`^${code}$`, 'i') } }
      ],
      active: true
    }).select('pricing name nameFr').lean();

    if (act?.pricing?.basePrice) {
      return {
        price: act.pricing.basePrice,
        name: act.nameFr || act.name,
        source: 'clinical_act',
        currency: act.pricing.currency
      };
    }

    log.debug('No price found for code', { code, type, clinicId });
    return null;
  } catch (error) {
    log.warn('Price lookup failed', { error: error.message, code, type });
    return null;
  }
}

/**
 * Check if any invoice items require prior approval
 */
async function checkApprovalRequirements(invoice, company, patientId) {
  const itemsNeedingApproval = [];

  if (!company?.actsRequiringApproval?.length && !company?.coveredCategories?.length) {
    return { itemsNeedingApproval };
  }

  for (const item of invoice.items) {
    let requiresApproval = false;
    let approvalReason = null;

    // Check if specific act requires approval
    if (company.actsRequiringApproval?.length > 0) {
      const specificAct = company.actsRequiringApproval.find(
        a => a.actCode?.toUpperCase() === item.code?.toUpperCase()
      );
      if (specificAct) {
        requiresApproval = true;
        approvalReason = specificAct.reason || 'Acte nécessitant approbation préalable';
      }
    }

    // Check if category requires approval
    if (!requiresApproval && company.coveredCategories?.length > 0) {
      const categorySettings = company.coveredCategories.find(
        c => c.category === item.category
      );
      if (categorySettings?.requiresApproval) {
        requiresApproval = true;
        approvalReason = `Catégorie "${item.category}" nécessite approbation`;
      }
    }

    if (requiresApproval) {
      // Check if approval already exists
      const existingApproval = await Approval.findOne({
        patient: patientId,
        company: company._id,
        'items.code': item.code,
        status: 'approved',
        validUntil: { $gte: new Date() }
      });

      if (!existingApproval) {
        itemsNeedingApproval.push({
          code: item.code,
          description: item.description,
          category: item.category,
          reason: approvalReason,
          hasApproval: false
        });
      }
    }
  }

  return { itemsNeedingApproval };
}

/**
 * Send real-time notifications
 */
async function sendNotifications(result, clinicId) {
  try {
    const ws = websocketService.getInstance?.() || websocketService;

    // Notify lab about new orders
    if (result.labOrders?.length > 0) {
      ws.emitToClinic?.(clinicId, 'lab:new_orders', {
        orders: result.labOrders.map(lo => ({
          id: lo._id,
          testCount: lo.tests?.length,
          priority: lo.priority
        }))
      });
    }

    // Notify pharmacy about new prescriptions
    if (result.prescriptions?.length > 0) {
      const medPrescriptions = result.prescriptions.filter(p => p.type === 'medication');
      if (medPrescriptions.length > 0) {
        ws.emitToClinic?.(clinicId, 'pharmacy:new_prescriptions', {
          prescriptions: medPrescriptions.map(p => ({
            id: p._id,
            medicationCount: p.medications?.length,
            hasWarnings: p.safetyChecks?.hasWarnings
          }))
        });
      }
    }

    // Notify billing about new invoice
    if (result.invoice) {
      ws.emitToClinic?.(clinicId, 'billing:new_invoice', {
        invoiceId: result.invoice._id,
        total: result.invoice.summary?.total,
        hasSurgery: result.invoice.items?.some(i => i.type === 'surgery')
      });
    }
  } catch (error) {
    log.warn('Failed to send notifications', { error: error.message });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function groupTestsBySpecimen(labTests) {
  const grouped = {};
  for (const test of labTests) {
    const specimen = test.specimenType || test.specimen || 'blood';
    if (!grouped[specimen]) {
      grouped[specimen] = [];
    }
    grouped[specimen].push(test);
  }
  return grouped;
}

function determinePriority(tests) {
  // Check if any test is marked urgent
  if (tests.some(t => t.priority === 'urgent' || t.priority === 'stat')) {
    return 'urgent';
  }
  return 'routine';
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function calculateValidUntil(medications) {
  // Default 30 days, or longest duration in medications
  let maxDays = 30;
  for (const med of medications) {
    if (med.duration && med.durationUnit === 'days') {
      maxDays = Math.max(maxDays, parseInt(med.duration) || 30);
    } else if (med.duration && med.durationUnit === 'weeks') {
      maxDays = Math.max(maxDays, (parseInt(med.duration) || 1) * 7);
    } else if (med.duration && med.durationUnit === 'months') {
      maxDays = Math.max(maxDays, (parseInt(med.duration) || 1) * 30);
    }
  }
  return new Date(Date.now() + maxDays * 24 * 60 * 60 * 1000);
}

function calculateQuantity(medication) {
  // Calculate quantity based on dosage and duration
  const frequency = parseFrequency(medication.frequency);
  const duration = parseInt(medication.duration) || 30;
  const durationMultiplier = medication.durationUnit === 'weeks' ? 7 :
    medication.durationUnit === 'months' ? 30 : 1;

  return Math.ceil(frequency * duration * durationMultiplier);
}

function parseFrequency(frequency) {
  // Parse frequency string to doses per day
  const freqMap = {
    'once daily': 1, 'od': 1, '1x/jour': 1,
    'twice daily': 2, 'bid': 2, '2x/jour': 2,
    'three times daily': 3, 'tid': 3, '3x/jour': 3,
    'four times daily': 4, 'qid': 4, '4x/jour': 4,
    'every hour': 24, '1x/heure': 24,
    'every 2 hours': 12, 'q2h': 12,
    'every 4 hours': 6, 'q4h': 6,
    'every 6 hours': 4, 'q6h': 4,
    'every 8 hours': 3, 'q8h': 3,
    'every 12 hours': 2, 'q12h': 2,
    'as needed': 4, 'prn': 4
  };
  return freqMap[frequency?.toLowerCase()] || 1;
}

function buildInstructions(medication) {
  const parts = [];

  if (medication.dosage) {
    parts.push(medication.dosage);
  }

  if (medication.frequency) {
    parts.push(medication.frequency);
  }

  if (medication.eye) {
    const eyeMap = { 'OD': 'oeil droit', 'OS': 'oeil gauche', 'OU': 'les deux yeux' };
    parts.push(eyeMap[medication.eye] || medication.eye);
  }

  if (medication.duration) {
    parts.push(`pendant ${medication.duration} ${medication.durationUnit || 'jours'}`);
  }

  return parts.join(', ') || medication.instructions || '';
}

function hasValidRefraction(refractionData) {
  const od = refractionData?.subjective?.OD;
  const os = refractionData?.subjective?.OS;

  // Check if at least one eye has valid refraction data
  return (od && (od.sphere !== null || od.cylinder !== null)) ||
         (os && (os.sphere !== null || os.cylinder !== null));
}

function determineLensType(refractionData) {
  const od = refractionData?.subjective?.OD || {};
  const os = refractionData?.subjective?.OS || {};

  // Check for presbyopia (needs addition)
  const hasAddition = od.add || os.add ||
    refractionData?.addition?.OD || refractionData?.addition?.OS;

  if (hasAddition) {
    return 'progressive'; // or 'bifocal'
  }

  // Check for high prescription
  const highSphere = Math.abs(od.sphere || 0) > 6 || Math.abs(os.sphere || 0) > 6;
  const highCylinder = Math.abs(od.cylinder || 0) > 2 || Math.abs(os.cylinder || 0) > 2;

  if (highSphere || highCylinder) {
    return 'high-index';
  }

  return 'single-vision';
}

async function getConsultationFee(clinicId, feeSchedule = null) {
  try {
    // Check provided fee schedule first
    if (feeSchedule?.items) {
      const consultItem = feeSchedule.items.find(i =>
        ['CONSULT_OPHTA', 'C001', 'CONSULTATION', 'CS'].includes(i.code?.toUpperCase())
      );
      if (consultItem) {
        return {
          code: consultItem.code,
          name: consultItem.name,
          price: consultItem.price
        };
      }
    }

    // Try to get from clinic's fee schedule
    const clinicSchedule = await FeeSchedule.findOne({
      clinic: clinicId,
      'items.code': { $in: ['CONSULT_OPHTA', 'C001', 'CONSULTATION', 'CS'] },
      isActive: true
    });

    if (clinicSchedule) {
      const consultItem = clinicSchedule.items.find(i =>
        ['CONSULT_OPHTA', 'C001', 'CONSULTATION', 'CS'].includes(i.code?.toUpperCase())
      );
      if (consultItem) {
        return {
          code: consultItem.code,
          name: consultItem.name,
          price: consultItem.price
        };
      }
    }

    // Try clinical acts
    const clinicalAct = await ClinicalAct.findOne({
      code: { $in: ['CONSULT_OPHTA', 'C001', 'CS'] },
      isActive: true
    });

    if (clinicalAct) {
      return {
        code: clinicalAct.code,
        name: clinicalAct.name,
        price: clinicalAct.basePrice || 0
      };
    }

    // Default consultation fee
    return {
      code: 'CONSULT_OPHTA',
      name: 'Consultation ophtalmologique',
      price: 15000 // Default CDF
    };
  } catch (error) {
    log.warn('Failed to get consultation fee', { error: error.message });
    return {
      code: 'CONSULT_OPHTA',
      name: 'Consultation ophtalmologique',
      price: 15000
    };
  }
}

/**
 * Smart consultation completion with automatic fallback to saga pattern
 *
 * Uses MongoDB transactions when available (replica set), otherwise
 * falls back to the saga pattern with compensation for atomicity.
 *
 * @param {Object} params - Same as completeConsultation
 * @param {Object} options - Additional options
 * @param {boolean} options.requireAtomicity - If true, fails when neither transactions nor saga can guarantee atomicity
 * @param {boolean} options.preferSaga - If true, always use saga pattern (for testing)
 * @returns {Promise<Object>} Result with created records
 */
async function completeConsultationSmart(params, options = {}) {
  const { requireAtomicity = false, preferSaga = false } = options;

  // Check if we should use saga pattern
  const hasTransactions = await supportsTransactions();
  const useSaga = preferSaga || !hasTransactions;

  if (useSaga) {
    log.info('Using saga pattern for consultation completion', {
      reason: preferSaga ? 'preferSaga option' : 'no transaction support',
      patientId: params.patientId,
      visitId: params.visitId
    });

    const sagaResult = await executeConsultationSaga(params);

    // Convert saga result to standard format
    return {
      success: sagaResult.status === SagaStatus.COMPLETED,
      data: sagaResult.data,
      warnings: sagaResult.data?.warnings || [],
      errors: sagaResult.error ? [sagaResult.error] : [],
      metadata: {
        usedSaga: true,
        sagaId: sagaResult.sagaId,
        sagaStatus: sagaResult.status,
        steps: sagaResult.steps
      }
    };
  }

  // Use transaction-based approach
  log.info('Using transaction for consultation completion', {
    patientId: params.patientId,
    visitId: params.visitId
  });

  return completeConsultation(params);
}

module.exports = {
  completeConsultation,
  completeConsultationSmart,
  // Export helpers for testing
  saveExam,
  createLabOrders,
  createPrescriptions,
  createOpticalPrescription,
  generateInvoice
};
